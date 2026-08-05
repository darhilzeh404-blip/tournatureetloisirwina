DROP POLICY IF EXISTS "Agency owner updates own" ON public.partner_agencies;

CREATE POLICY "Agency owner updates own"
ON public.partner_agencies
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (
  owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.partner_agencies AS existing
    WHERE existing.id = partner_agencies.id
      AND existing.owner_user_id = partner_agencies.owner_user_id
      AND existing.is_verified IS NOT DISTINCT FROM partner_agencies.is_verified
      AND existing.commission_percent IS NOT DISTINCT FROM partner_agencies.commission_percent
  )
);