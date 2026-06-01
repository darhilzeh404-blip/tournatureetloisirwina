CREATE OR REPLACE FUNCTION public.is_vtc_reservation(_reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.id = _reservation_id
      AND r.service_type = 'VTC'::service_type
      AND r.archived_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.can_chauffeur_view_vtc_reservation(_user_id uuid, _reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'chauffeur'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.trips t
      JOIN public.reservations r ON r.id = t.reservation_id
      WHERE r.id = _reservation_id
        AND r.service_type = 'VTC'::service_type
        AND r.archived_at IS NULL
        AND t.archived_at IS NULL
        AND (
          (t.driver_id IS NULL AND t.status = 'pending')
          OR t.driver_id = _user_id
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_client_view_assigned_vtc_driver(_client_id uuid, _driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips t
    JOIN public.reservations r ON r.id = t.reservation_id
    WHERE t.client_id = _client_id
      AND t.driver_id = _driver_id
      AND t.archived_at IS NULL
      AND t.status IN ('assigned', 'active')
      AND r.service_type = 'VTC'::service_type
  )
$$;

DROP POLICY IF EXISTS "Chauffeurs view pending VTC pool" ON public.trips;
CREATE POLICY "Chauffeurs view pending VTC pool"
ON public.trips
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'chauffeur'::app_role)
  AND driver_id IS NULL
  AND status = 'pending'
  AND archived_at IS NULL
  AND public.is_vtc_reservation(reservation_id)
);

DROP POLICY IF EXISTS "Chauffeurs view VTC trip reservations" ON public.reservations;
CREATE POLICY "Chauffeurs view VTC trip reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (public.can_chauffeur_view_vtc_reservation(auth.uid(), id));

DROP POLICY IF EXISTS "Clients view assigned VTC driver profile" ON public.profiles;
CREATE POLICY "Clients view assigned VTC driver profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_client_view_assigned_vtc_driver(auth.uid(), user_id));

DROP POLICY IF EXISTS "Clients view assigned VTC driver row" ON public.drivers;
CREATE POLICY "Clients view assigned VTC driver row"
ON public.drivers
FOR SELECT
TO authenticated
USING (public.can_client_view_assigned_vtc_driver(auth.uid(), user_id));

DROP POLICY IF EXISTS "Clients view assigned driver position" ON public.driver_positions;
CREATE POLICY "Clients view assigned driver position"
ON public.driver_positions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.driver_id = driver_positions.driver_id
      AND t.client_id = auth.uid()
      AND t.archived_at IS NULL
      AND t.status IN ('assigned', 'active')
  )
);

CREATE OR REPLACE FUNCTION public.trigger_driver_search(_trip_id uuid)
RETURNS TABLE(nearby_count integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trip public.trips;
  _count integer := 0;
BEGIN
  SELECT * INTO _trip FROM public.trips WHERE id = _trip_id;

  IF _trip.id IS NULL THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  IF NOT (auth.uid() = _trip.client_id OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF _trip.origin_lat IS NULL OR _trip.origin_lng IS NULL THEN
    RAISE EXCEPTION 'MISSING_ORIGIN';
  END IF;

  SELECT COUNT(*) INTO _count
  FROM public.find_nearby_vtc_drivers(_trip.origin_lat, _trip.origin_lng, 5);

  RETURN QUERY SELECT _count, _trip.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_vtc_trip(_trip_id uuid)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.trips;
  _trip public.trips;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.has_role(_uid, 'chauffeur'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO _trip
  FROM public.trips
  WHERE id = _trip_id
    AND driver_id IS NULL
    AND status = 'pending'
    AND archived_at IS NULL;

  IF _trip.id IS NULL THEN
    RAISE EXCEPTION 'ALREADY_TAKEN';
  END IF;

  IF NOT public.is_vtc_reservation(_trip.reservation_id) THEN
    RAISE EXCEPTION 'NOT_VTC_TRIP';
  END IF;

  IF _trip.origin_lat IS NULL OR _trip.origin_lng IS NULL THEN
    RAISE EXCEPTION 'MISSING_ORIGIN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.find_nearby_vtc_drivers(_trip.origin_lat, _trip.origin_lng, 5) d
    WHERE d.driver_id = _uid
  ) THEN
    RAISE EXCEPTION 'DRIVER_NOT_AVAILABLE';
  END IF;

  UPDATE public.trips
     SET driver_id = _uid,
         status = 'assigned',
         eta_minutes = COALESCE(
           eta_minutes,
           GREATEST(1, CEIL((
             SELECT d.distance_km
             FROM public.find_nearby_vtc_drivers(_trip.origin_lat, _trip.origin_lng, 5) d
             WHERE d.driver_id = _uid
             LIMIT 1
           ) / 30 * 60)::integer)
         ),
         updated_at = now()
   WHERE id = _trip_id
     AND driver_id IS NULL
     AND status = 'pending'
     AND archived_at IS NULL
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'ALREADY_TAKEN';
  END IF;

  RETURN _row;
END;
$$;