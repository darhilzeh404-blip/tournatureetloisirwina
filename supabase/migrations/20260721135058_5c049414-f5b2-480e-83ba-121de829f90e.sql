DROP POLICY IF EXISTS "block_anon_partner_agencies" ON public.partner_agencies;

DROP POLICY IF EXISTS "Public can view active partner agencies" ON public.partner_agencies;
CREATE POLICY "Public can view active partner agencies"
  ON public.partner_agencies
  FOR SELECT
  TO anon
  USING (is_active = true);

GRANT SELECT (id, name, logo_url, is_active, is_verified, description, category) ON public.partner_agencies TO anon;
GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';