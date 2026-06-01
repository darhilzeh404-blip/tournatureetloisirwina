CREATE OR REPLACE FUNCTION public.find_nearby_vtc_drivers(_pickup_lat numeric, _pickup_lng numeric, _radius_km numeric DEFAULT 5)
 RETURNS TABLE(driver_id uuid, latitude numeric, longitude numeric, distance_km numeric, last_seen_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.driver_id,
    p.latitude,
    p.longitude,
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
    -- Driver is considered reachable if EITHER the availability heartbeat
    -- OR the position update happened within the last 10 minutes.
    AND (
      a.last_seen_at > now() - interval '10 minutes'
      OR p.updated_at > now() - interval '10 minutes'
    )
    AND p.updated_at > now() - interval '30 minutes'
    AND (2 * 6371 * asin(sqrt(
      power(sin(radians((p.latitude  - _pickup_lat) / 2)), 2)
      + cos(radians(_pickup_lat)) * cos(radians(p.latitude))
      * power(sin(radians((p.longitude - _pickup_lng) / 2)), 2)
    ))) <= _radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
$function$;