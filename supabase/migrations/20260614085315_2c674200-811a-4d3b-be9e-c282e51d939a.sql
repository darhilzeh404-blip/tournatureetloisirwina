
-- 1. Replace overly-broad client SELECT policy on drivers with a safe RPC
DROP POLICY IF EXISTS "Clients view assigned VTC driver row" ON public.drivers;

CREATE OR REPLACE FUNCTION public.get_assigned_vtc_driver(_trip_id uuid)
RETURNS TABLE (full_name text, phone text, vehicle_type text, license_plate text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.full_name, d.phone, d.vehicle_type, d.license_plate
  FROM public.trips t
  JOIN public.drivers d ON d.user_id = t.driver_id
  WHERE t.id = _trip_id
    AND public.can_client_view_assigned_vtc_driver(auth.uid(), t.driver_id);
$$;

REVOKE EXECUTE ON FUNCTION public.get_assigned_vtc_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assigned_vtc_driver(uuid) TO authenticated, service_role;

-- 2. Tighten realtime broadcast read policy: remove broad trip/ride/vtc/group_ride wildcards.
-- App code uses postgres_changes (own auth) and user:<uid> topics only; admins keep full access.
DROP POLICY IF EXISTS "wina_realtime_read" ON realtime.messages;
CREATE POLICY "wina_realtime_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role)
  OR topic = ('user:' || (SELECT auth.uid())::text)
  OR topic LIKE ('user:' || (SELECT auth.uid())::text || ':%')
  OR topic LIKE 'announcements%'
);

-- 3. Reinforce partner_agencies anon column protection (defense in depth)
REVOKE SELECT (email, phone) ON public.partner_agencies FROM anon;
