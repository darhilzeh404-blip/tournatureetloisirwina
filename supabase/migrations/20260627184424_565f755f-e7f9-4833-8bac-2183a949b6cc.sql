
-- =========================================================
-- RESTRICTIVE RLS reinforcements
-- These apply ON TOP of existing PERMISSIVE policies (AND logic).
-- Goal: even if a permissive policy is misconfigured, anon
-- users can NEVER read sensitive rows.
-- =========================================================

-- Helper: drop-if-exists pattern for idempotency
DO $$ BEGIN
  -- partner_agencies: never expose to anon, owner/admin only
  DROP POLICY IF EXISTS "restrict_partner_agencies_to_owner_or_admin" ON public.partner_agencies;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "restrict_partner_agencies_to_owner_or_admin"
ON public.partner_agencies
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Block anon entirely on partner_agencies (table-level)
DROP POLICY IF EXISTS "block_anon_partner_agencies" ON public.partner_agencies;
CREATE POLICY "block_anon_partner_agencies"
ON public.partner_agencies
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- partner_bookings: only the booking's agency owner or admin
DROP POLICY IF EXISTS "restrict_partner_bookings_to_agency_or_admin" ON public.partner_bookings;
CREATE POLICY "restrict_partner_bookings_to_agency_or_admin"
ON public.partner_bookings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  public.is_agency_owner(auth.uid(), agency_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_agency_owner(auth.uid(), agency_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "block_anon_partner_bookings" ON public.partner_bookings;
CREATE POLICY "block_anon_partner_bookings"
ON public.partner_bookings AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- partner_ticket_codes: scoped to agency owner / admin
DROP POLICY IF EXISTS "restrict_partner_ticket_codes_to_agency_or_admin" ON public.partner_ticket_codes;
CREATE POLICY "restrict_partner_ticket_codes_to_agency_or_admin"
ON public.partner_ticket_codes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  public.is_agency_owner(auth.uid(), agency_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.is_agency_owner(auth.uid(), agency_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "block_anon_partner_ticket_codes" ON public.partner_ticket_codes;
CREATE POLICY "block_anon_partner_ticket_codes"
ON public.partner_ticket_codes AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- booking_status_history: only agency owner or admin
DROP POLICY IF EXISTS "restrict_booking_status_history" ON public.booking_status_history;
CREATE POLICY "restrict_booking_status_history"
ON public.booking_status_history
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.partner_bookings b
    WHERE b.id = booking_id
      AND (public.is_agency_owner(auth.uid(), b.agency_id) OR b.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "block_anon_booking_status_history" ON public.booking_status_history;
CREATE POLICY "block_anon_booking_status_history"
ON public.booking_status_history AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- agency_notifications: scoped to agency owner / admin
DROP POLICY IF EXISTS "restrict_agency_notifications" ON public.agency_notifications;
CREATE POLICY "restrict_agency_notifications"
ON public.agency_notifications
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  public.is_agency_owner(auth.uid(), agency_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.is_agency_owner(auth.uid(), agency_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "block_anon_agency_notifications" ON public.agency_notifications;
CREATE POLICY "block_anon_agency_notifications"
ON public.agency_notifications AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- client_error_logs: admin-only read; anon fully blocked
DROP POLICY IF EXISTS "restrict_client_error_logs_admin_only" ON public.client_error_logs;
CREATE POLICY "restrict_client_error_logs_admin_only"
ON public.client_error_logs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_client_error_logs" ON public.client_error_logs;
CREATE POLICY "block_anon_client_error_logs"
ON public.client_error_logs AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- driver_wallets / driver_wallet_transactions
DROP POLICY IF EXISTS "restrict_driver_wallets" ON public.driver_wallets;
CREATE POLICY "restrict_driver_wallets"
ON public.driver_wallets AS RESTRICTIVE FOR ALL TO authenticated
USING (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_driver_wallets" ON public.driver_wallets;
CREATE POLICY "block_anon_driver_wallets"
ON public.driver_wallets AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "restrict_driver_wallet_tx" ON public.driver_wallet_transactions;
CREATE POLICY "restrict_driver_wallet_tx"
ON public.driver_wallet_transactions AS RESTRICTIVE FOR ALL TO authenticated
USING (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_driver_wallet_tx" ON public.driver_wallet_transactions;
CREATE POLICY "block_anon_driver_wallet_tx"
ON public.driver_wallet_transactions AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- vtc_wallets / vtc_wallet_transactions
DROP POLICY IF EXISTS "restrict_vtc_wallets" ON public.vtc_wallets;
CREATE POLICY "restrict_vtc_wallets"
ON public.vtc_wallets AS RESTRICTIVE FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_vtc_wallets" ON public.vtc_wallets;
CREATE POLICY "block_anon_vtc_wallets"
ON public.vtc_wallets AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "restrict_vtc_wallet_tx" ON public.vtc_wallet_transactions;
CREATE POLICY "restrict_vtc_wallet_tx"
ON public.vtc_wallet_transactions AS RESTRICTIVE FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_vtc_wallet_tx" ON public.vtc_wallet_transactions;
CREATE POLICY "block_anon_vtc_wallet_tx"
ON public.vtc_wallet_transactions AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- vtc_recharge_requests
DROP POLICY IF EXISTS "restrict_vtc_recharge_requests" ON public.vtc_recharge_requests;
CREATE POLICY "restrict_vtc_recharge_requests"
ON public.vtc_recharge_requests AS RESTRICTIVE FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_vtc_recharge_requests" ON public.vtc_recharge_requests;
CREATE POLICY "block_anon_vtc_recharge_requests"
ON public.vtc_recharge_requests AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- wina_coin_balances / history / redemptions
DROP POLICY IF EXISTS "restrict_wina_balances" ON public.wina_coin_balances;
CREATE POLICY "restrict_wina_balances"
ON public.wina_coin_balances AS RESTRICTIVE FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_wina_balances" ON public.wina_coin_balances;
CREATE POLICY "block_anon_wina_balances"
ON public.wina_coin_balances AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "restrict_wina_history" ON public.wina_coins_history;
CREATE POLICY "restrict_wina_history"
ON public.wina_coins_history AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_wina_history" ON public.wina_coins_history;
CREATE POLICY "block_anon_wina_history"
ON public.wina_coins_history AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "restrict_wina_redemptions" ON public.wina_gift_redemptions;
CREATE POLICY "restrict_wina_redemptions"
ON public.wina_gift_redemptions AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_wina_redemptions" ON public.wina_gift_redemptions;
CREATE POLICY "block_anon_wina_redemptions"
ON public.wina_gift_redemptions AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- profiles: PII never visible to anon
DROP POLICY IF EXISTS "block_anon_profiles" ON public.profiles;
CREATE POLICY "block_anon_profiles"
ON public.profiles AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- drivers (PII: phone, license) — block anon
DROP POLICY IF EXISTS "block_anon_drivers" ON public.drivers;
CREATE POLICY "block_anon_drivers"
ON public.drivers AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- audit_logs admin-only
DROP POLICY IF EXISTS "restrict_audit_logs_admin_only" ON public.audit_logs;
CREATE POLICY "restrict_audit_logs_admin_only"
ON public.audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_audit_logs" ON public.audit_logs;
CREATE POLICY "block_anon_audit_logs"
ON public.audit_logs AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);
