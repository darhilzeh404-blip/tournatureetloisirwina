CREATE OR REPLACE VIEW public.partner_agencies_public
WITH (security_invoker = false) AS
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

GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';