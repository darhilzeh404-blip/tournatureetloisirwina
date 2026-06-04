
-- 1. Restrict co-passenger SELECT on group_ride_passengers to prevent
--    leaking pickup/destination addresses to other passengers.
DROP POLICY IF EXISTS "Users see co-passengers of their ride" ON public.group_ride_passengers;

-- 2. Enforce changed_by = auth.uid() on group_ride_status_history inserts
DROP POLICY IF EXISTS "Participants insert history" ON public.group_ride_status_history;
CREATE POLICY "Participants insert history"
  ON public.group_ride_status_history
  FOR INSERT
  WITH CHECK (
    changed_by = auth.uid()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.group_ride_passengers p
        WHERE p.ride_id = group_ride_status_history.ride_id
          AND p.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.group_rides r
        WHERE r.id = group_ride_status_history.ride_id
          AND r.driver_id = auth.uid()
      )
    )
  );

-- 3. Restrict partner_agencies.email exposure (column-level grants).
--    Phone is intentional public contact info (call CTA on ticket cards).
--    Email is not displayed publicly; restrict to authenticated users only.
REVOKE SELECT (email) ON public.partner_agencies FROM anon;
