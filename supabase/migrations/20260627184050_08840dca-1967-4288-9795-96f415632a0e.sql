
-- 1. partner_agencies: restrict SELECT to owner + admin
DROP POLICY IF EXISTS "Authenticated view active safe or own admin agencies" ON public.partner_agencies;

CREATE POLICY "Owner or admin can view agencies"
ON public.partner_agencies
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2. client_error_logs: remove permissive INSERT policy (writes go through SECURITY DEFINER RPC report_client_error)
DROP POLICY IF EXISTS "anyone can report errors" ON public.client_error_logs;
