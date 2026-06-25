DROP POLICY IF EXISTS "Public can view active agency safe columns" ON public.partner_agencies;
REVOKE SELECT ON public.partner_agencies FROM anon;
GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;