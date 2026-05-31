-- Find nearby online VTC drivers (haversine, km) and dispatch a pending trip.
-- SECURITY DEFINER so clients (the booking user) can run it without breaking RLS.

CREATE OR REPLACE FUNCTION public.find_nearby_vtc_drivers(
  _pickup_lat numeric,
  _pickup_lng numeric,
  _radius_km numeric DEFAULT 5
)
RETURNS TABLE(
  driver_id uuid,
  latitude numeric,
  longitude numeric,
  distance_km numeric,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.driver_id,
    p.latitude,
    p.longitude,
    -- Haversine distance in km
    (2 * 6371 * asin(sqrt(
      power(sin(radians((p.latitude  - _pickup_lat) / 2)), 2)
      + cos(radians(_pickup_lat)) * cos(radians(p.latitude))
      * power(sin(radians((p.longitude - _pickup_lng) / 2)), 2)
    )))::numeric AS distance_km,
    a.last_seen_at
  FROM public.driver_positions p
  JOIN public.driver_availability a ON a.driver_id = p.driver_id
  JOIN public.user_roles r ON r.user_id = p.driver_id AND r.role = 'chauffeur'::app_role
  WHERE p.archived_at IS NULL
    AND a.is_online = true
    AND a.last_seen_at > now() - interval '2 minutes'
    AND (2 * 6371 * asin(sqrt(
      power(sin(radians((p.latitude  - _pickup_lat) / 2)), 2)
      + cos(radians(_pickup_lat)) * cos(radians(p.latitude))
      * power(sin(radians((p.longitude - _pickup_lng) / 2)), 2)
    ))) <= _radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.find_nearby_vtc_drivers(numeric, numeric, numeric) TO authenticated;

-- Dispatch: count nearby drivers; if none, mark trip status='no_driver_found'.
-- Realtime INSERT on `trips` already fans out to drivers, so the trip insert
-- itself is the notification — this RPC is the "post-flight" check.
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
  -- Only the client who owns the trip (or an admin) may trigger
  IF NOT (auth.uid() = _trip.client_id OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _trip.origin_lat IS NULL OR _trip.origin_lng IS NULL THEN
    RAISE EXCEPTION 'MISSING_ORIGIN';
  END IF;

  SELECT COUNT(*) INTO _count
    FROM public.find_nearby_vtc_drivers(_trip.origin_lat, _trip.origin_lng, 5);

  IF _count = 0 AND _trip.status = 'pending' AND _trip.driver_id IS NULL THEN
    UPDATE public.trips
       SET status = 'no_driver_found', updated_at = now()
     WHERE id = _trip_id;
    RETURN QUERY SELECT 0, 'no_driver_found'::text;
  ELSE
    RETURN QUERY SELECT _count, _trip.status;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_driver_search(uuid) TO authenticated;