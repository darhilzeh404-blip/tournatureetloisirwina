
-- 1. Revoke EXECUTE from PUBLIC/anon on internal RPC SECURITY DEFINER functions, grant to authenticated only
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.accept_ride(uuid)',
    'public.complete_ride(uuid)',
    'public.archive_trip_and_reservation(uuid)',
    'public.award_wina_coins(uuid)',
    'public.refund_wina_coins(uuid)',
    'public.admin_adjust_coins(uuid, integer, text)',
    'public.award_wina_coins_group_payment(uuid)',
    'public.refund_wina_coins_group_payment(uuid)',
    'public.trigger_driver_search(uuid)',
    'public.accept_vtc_trip(uuid)',
    'public.get_driver_vtc_earnings(uuid)',
    'public.spend_wina_coins(uuid, integer)',
    'public.recompute_vip_level(uuid)',
    'public.find_nearby_vtc_drivers(numeric, numeric, numeric)',
    'public.join_group_ride(text, smallint, integer, integer, smallint, text, numeric, numeric, text, numeric, numeric, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- 2. RLS helper functions used inside policies: revoke from PUBLIC, keep callable for authenticated + service_role
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.has_role(uuid, app_role)',
    'public.gerant_has_circuit(uuid, uuid)',
    'public.gerant_has_circuit_named(uuid, text)',
    'public.is_vtc_reservation(uuid)',
    'public.can_chauffeur_view_vtc_reservation(uuid, uuid)',
    'public.can_client_view_assigned_vtc_driver(uuid, uuid)',
    'public.is_group_ride_passenger(uuid, uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- 3. Trigger functions: revoke EXECUTE from PUBLIC (triggers run as table owner, no app role needs to invoke them)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_driver_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_passenger_field_tampering() FROM PUBLIC, anon, authenticated;

-- 4. RLS on realtime.messages (broadcast / presence channels)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wina_realtime_read" ON realtime.messages;
DROP POLICY IF EXISTS "wina_realtime_write" ON realtime.messages;

-- Authenticated users can SUBSCRIBE/READ only on allowed topic prefixes
CREATE POLICY "wina_realtime_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role)
  OR topic = ('user:' || (SELECT auth.uid())::text)
  OR topic LIKE ('user:' || (SELECT auth.uid())::text || ':%')
  OR topic LIKE 'trip:%'
  OR topic LIKE 'ride:%'
  OR topic LIKE 'group_ride:%'
  OR topic LIKE 'vtc:%'
  OR topic LIKE 'announcements%'
);

-- Authenticated users can BROADCAST only on their own user topic, or admins anywhere
CREATE POLICY "wina_realtime_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'admin'::app_role)
  OR topic = ('user:' || (SELECT auth.uid())::text)
  OR topic LIKE ('user:' || (SELECT auth.uid())::text || ':%')
);
