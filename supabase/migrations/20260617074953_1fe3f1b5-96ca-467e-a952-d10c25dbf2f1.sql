
-- 1) Tighten chauffeur access to reservations: only when they are the assigned driver.
CREATE OR REPLACE FUNCTION public.can_chauffeur_view_vtc_reservation(_user_id uuid, _reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
        AND t.driver_id = _user_id
    )
$$;

-- 2) Safe RPC for pool: returns only minimal, non-sensitive fields the driver needs to decide.
CREATE OR REPLACE FUNCTION public.get_vtc_pending_pool()
RETURNS TABLE (
  trip_id uuid,
  reservation_id uuid,
  created_at timestamptz,
  origin_address text,
  destination_address text,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  total_amount integer,
  payment_mode text,
  reservation_date timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id,
    r.id,
    t.created_at,
    t.origin_address,
    t.destination_address,
    t.origin_lat,
    t.origin_lng,
    t.destination_lat,
    t.destination_lng,
    r.total_amount,
    COALESCE(r.details->>'payment_mode', 'mobile_money'),
    r.reservation_date
  FROM public.trips t
  JOIN public.reservations r ON r.id = t.reservation_id
  WHERE public.has_role(auth.uid(), 'chauffeur'::app_role)
    AND t.driver_id IS NULL
    AND t.status = 'pending'
    AND t.archived_at IS NULL
    AND r.archived_at IS NULL
    AND r.service_type = 'VTC'::service_type
  ORDER BY t.created_at DESC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vtc_pending_pool() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vtc_pending_pool() TO authenticated;

-- 3) Remove driver's broad SELECT on group_ride_passengers; expose only commune-level fields via RPC.
DROP POLICY IF EXISTS "Drivers see passengers of their ride" ON public.group_ride_passengers;

CREATE OR REPLACE FUNCTION public.get_group_ride_passengers_for_driver(_ride_id uuid)
RETURNS TABLE (
  id uuid,
  ride_id uuid,
  user_id uuid,
  seat_index smallint,
  commune_pickup text,
  commune_destination text,
  status text,
  joined_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.ride_id, p.user_id, p.seat_index,
         p.commune_pickup, p.commune_destination,
         p.status::text, p.joined_at
  FROM public.group_ride_passengers p
  WHERE p.ride_id = _ride_id
    AND public.is_group_ride_driver(auth.uid(), _ride_id);
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_ride_passengers_for_driver(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_group_ride_passengers_for_driver(uuid) TO authenticated;
