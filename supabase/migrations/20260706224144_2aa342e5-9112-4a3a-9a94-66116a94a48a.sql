
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS category public.vtc_category;

CREATE OR REPLACE FUNCTION public.set_trip_category_from_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat_txt text;
BEGIN
  IF NEW.category IS NOT NULL THEN RETURN NEW; END IF;
  SELECT UPPER(COALESCE(r.details->>'category', ''))
    INTO _cat_txt
  FROM public.reservations r
  WHERE r.id = NEW.reservation_id;
  IF _cat_txt IN ('STANDARD','CONFORT','VIP') THEN
    NEW.category := _cat_txt::public.vtc_category;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_trip_category ON public.trips;
CREATE TRIGGER trg_set_trip_category
BEFORE INSERT OR UPDATE OF reservation_id ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.set_trip_category_from_reservation();

UPDATE public.trips t
SET category = (UPPER(r.details->>'category'))::public.vtc_category
FROM public.reservations r
WHERE t.reservation_id = r.id
  AND t.category IS NULL
  AND UPPER(COALESCE(r.details->>'category','')) IN ('STANDARD','CONFORT','VIP');

DROP FUNCTION IF EXISTS public.find_nearby_vtc_drivers(numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.find_nearby_vtc_drivers(numeric, numeric, numeric, public.vtc_category);

CREATE OR REPLACE FUNCTION public.find_nearby_vtc_drivers(
  _pickup_lat numeric,
  _pickup_lng numeric,
  _radius_km numeric DEFAULT 5,
  _category public.vtc_category DEFAULT NULL
)
RETURNS TABLE(driver_id uuid, latitude numeric, longitude numeric, distance_km numeric, last_seen_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.driver_id, p.latitude, p.longitude,
    (2 * 6371 * asin(sqrt(
      power(sin(radians((p.latitude  - _pickup_lat) / 2)), 2)
      + cos(radians(_pickup_lat)) * cos(radians(p.latitude))
      * power(sin(radians((p.longitude - _pickup_lng) / 2)), 2)
    )))::numeric AS distance_km,
    a.last_seen_at
  FROM public.driver_positions p
  JOIN public.driver_availability a ON a.driver_id = p.driver_id
  JOIN public.user_roles r ON r.user_id = p.driver_id AND r.role = 'chauffeur'::app_role
  JOIN public.drivers d ON d.user_id = p.driver_id
  WHERE p.archived_at IS NULL
    AND a.is_online = true
    AND (a.last_seen_at > now() - interval '10 minutes' OR p.updated_at > now() - interval '10 minutes')
    AND p.updated_at > now() - interval '30 minutes'
    AND (_category IS NULL OR d.category = _category)
    AND (2 * 6371 * asin(sqrt(
      power(sin(radians((p.latitude  - _pickup_lat) / 2)), 2)
      + cos(radians(_pickup_lat)) * cos(radians(p.latitude))
      * power(sin(radians((p.longitude - _pickup_lng) / 2)), 2)
    ))) <= _radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.find_nearby_vtc_drivers(numeric, numeric, numeric, public.vtc_category) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_nearby_vtc_drivers(numeric, numeric, numeric, public.vtc_category) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trigger_driver_search(_trip_id uuid)
RETURNS TABLE(nearby_count integer, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _trip public.trips; _count integer := 0;
BEGIN
  SELECT * INTO _trip FROM public.trips WHERE id = _trip_id;
  IF _trip.id IS NULL THEN RAISE EXCEPTION 'TRIP_NOT_FOUND'; END IF;
  IF NOT (auth.uid() = _trip.client_id OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _trip.origin_lat IS NULL OR _trip.origin_lng IS NULL THEN
    RAISE EXCEPTION 'MISSING_ORIGIN'; END IF;
  SELECT COUNT(*) INTO _count
  FROM public.find_nearby_vtc_drivers(_trip.origin_lat, _trip.origin_lng, 5, _trip.category);
  RETURN QUERY SELECT _count, _trip.status;
END; $$;

REVOKE EXECUTE ON FUNCTION public.trigger_driver_search(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_driver_search(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_vtc_trip(_trip_id uuid)
RETURNS public.trips
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.trips; _trip public.trips;
  _driver_cat public.vtc_category;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'chauffeur'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO _trip FROM public.trips
  WHERE id = _trip_id AND driver_id IS NULL AND status = 'pending' AND archived_at IS NULL;
  IF _trip.id IS NULL THEN RAISE EXCEPTION 'ALREADY_TAKEN'; END IF;
  IF NOT public.is_vtc_reservation(_trip.reservation_id) THEN RAISE EXCEPTION 'NOT_VTC_TRIP'; END IF;
  IF _trip.origin_lat IS NULL OR _trip.origin_lng IS NULL THEN RAISE EXCEPTION 'MISSING_ORIGIN'; END IF;

  SELECT category INTO _driver_cat FROM public.drivers WHERE user_id = _uid;
  IF _trip.category IS NOT NULL AND _driver_cat IS NOT NULL AND _driver_cat <> _trip.category THEN
    RAISE EXCEPTION 'CATEGORY_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.find_nearby_vtc_drivers(_trip.origin_lat, _trip.origin_lng, 5, _trip.category) d
    WHERE d.driver_id = _uid
  ) THEN RAISE EXCEPTION 'DRIVER_NOT_AVAILABLE'; END IF;

  UPDATE public.trips
     SET driver_id = _uid, status = 'assigned',
         eta_minutes = COALESCE(eta_minutes, GREATEST(1, CEIL((
           SELECT d.distance_km FROM public.find_nearby_vtc_drivers(_trip.origin_lat, _trip.origin_lng, 5, _trip.category) d
           WHERE d.driver_id = _uid LIMIT 1
         ) / 30 * 60)::integer)),
         updated_at = now()
   WHERE id = _trip_id AND driver_id IS NULL AND status = 'pending' AND archived_at IS NULL
  RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'ALREADY_TAKEN'; END IF;
  RETURN _row;
END; $$;

REVOKE EXECUTE ON FUNCTION public.accept_vtc_trip(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_vtc_trip(uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_vtc_pending_pool();

CREATE OR REPLACE FUNCTION public.get_vtc_pending_pool()
RETURNS TABLE (
  trip_id uuid, reservation_id uuid, created_at timestamptz,
  origin_address text, destination_address text,
  origin_lat numeric, origin_lng numeric, destination_lat numeric, destination_lng numeric,
  total_amount integer, payment_mode text, reservation_date timestamptz, category text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id, r.id, t.created_at,
    t.origin_address, t.destination_address,
    t.origin_lat, t.origin_lng, t.destination_lat, t.destination_lng,
    r.total_amount,
    COALESCE(r.details->>'payment_mode', 'mobile_money'),
    r.reservation_date, t.category::text
  FROM public.trips t
  JOIN public.reservations r ON r.id = t.reservation_id
  LEFT JOIN public.drivers d ON d.user_id = auth.uid()
  WHERE public.has_role(auth.uid(), 'chauffeur'::app_role)
    AND t.driver_id IS NULL AND t.status = 'pending'
    AND t.archived_at IS NULL AND r.archived_at IS NULL
    AND r.service_type = 'VTC'::service_type
    AND (t.category IS NULL OR d.category IS NULL OR t.category = d.category)
  ORDER BY t.created_at DESC LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vtc_pending_pool() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vtc_pending_pool() TO authenticated;
