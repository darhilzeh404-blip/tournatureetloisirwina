
DROP VIEW IF EXISTS public.partner_agencies_public;
CREATE VIEW public.partner_agencies_public
WITH (security_invoker=on) AS
  SELECT id, name, logo_url, is_active, is_verified, description, category, phone, email
  FROM public.partner_agencies
  WHERE is_active = true;

GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;
