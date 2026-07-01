
-- 1. Fix conflicting restrictive policy on audit_logs
DROP POLICY IF EXISTS restrict_audit_logs_admin_only ON public.audit_logs;
CREATE POLICY restrict_audit_logs_owner_or_admin ON public.audit_logs
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (agency_id IS NOT NULL AND is_agency_owner(auth.uid(), agency_id))
  );

-- 2. Add INSERT policy for wina_gift_redemptions
CREATE POLICY "Users insert own redemptions" ON public.wina_gift_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Add INSERT policy for wina_lottery_entries
CREATE POLICY "Users insert own entries" ON public.wina_lottery_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
