
-- 1. Buses: restrict SELECT to authenticated users (hides chauffeur name from public)
DROP POLICY IF EXISTS "Anyone can view buses" ON public.buses;
CREATE POLICY "Authenticated users can view buses"
  ON public.buses FOR SELECT
  TO authenticated
  USING (true);

-- 2. transport_settings: hide sensitive keys from public
DROP POLICY IF EXISTS "Anyone can view transport_settings" ON public.transport_settings;
CREATE POLICY "Public can view non-sensitive transport_settings"
  ON public.transport_settings FOR SELECT
  USING (
    key NOT IN ('whatsapp_admin_number', 'admin_phone', 'admin_email')
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. group_ride_status_history: only participants/drivers can insert
DROP POLICY IF EXISTS "System insert history" ON public.group_ride_status_history;
CREATE POLICY "Participants insert history"
  ON public.group_ride_status_history FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.group_ride_passengers p WHERE p.ride_id = group_ride_status_history.ride_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_rides r WHERE r.id = group_ride_status_history.ride_id AND r.driver_id = auth.uid())
  );

-- 4. payment-receipts: admin manage policies
CREATE POLICY "Admins can update payment receipts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payment-receipts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete payment receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payment-receipts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view payment receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-receipts' AND has_role(auth.uid(), 'admin'::app_role));

-- 5. Revoke EXECUTE on SECURITY DEFINER functions from anon (and trigger-only ones from authenticated)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerant_has_circuit(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerant_has_circuit_named(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_ride(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_ride(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_vtc_trip(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_trip_and_reservation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_group_ride(text, smallint, integer, integer, smallint, text, numeric, numeric, text, numeric, numeric, text, text) FROM anon;

-- Trigger-only functions: revoke from public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.normalize_driver_fields() FROM anon, authenticated, public;
