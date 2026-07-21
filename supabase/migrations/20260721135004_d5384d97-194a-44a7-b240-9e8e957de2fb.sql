CREATE OR REPLACE VIEW public.partner_agencies_public
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  logo_url,
  is_active,
  is_verified,
  description,
  category,
  NULL::text AS phone,
  NULL::text AS email
FROM public.partner_agencies
WHERE is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partner_agencies'
      AND policyname = 'Public can view active partner agencies'
  ) THEN
    CREATE POLICY "Public can view active partner agencies"
      ON public.partner_agencies
      FOR SELECT
      TO anon
      USING (is_active = true);
  END IF;
END $$;

GRANT SELECT (id, name, logo_url, is_active, is_verified, description, category) ON public.partner_agencies TO anon;
GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_agencies TO authenticated;
GRANT ALL ON public.partner_agencies TO service_role;

NOTIFY pgrst, 'reload schema';