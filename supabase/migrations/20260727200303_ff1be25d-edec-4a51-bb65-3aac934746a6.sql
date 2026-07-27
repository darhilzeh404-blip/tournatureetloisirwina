-- 1) Replace SECURITY DEFINER view with invoker view over a security-definer function
DROP VIEW IF EXISTS public.partner_agencies_public;

CREATE OR REPLACE FUNCTION public.list_public_partner_agencies()
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  is_active boolean,
  is_verified boolean,
  description text,
  category public.agency_category,
  phone text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.name, a.logo_url, a.is_active, a.is_verified,
         a.description, a.category,
         NULL::text AS phone, NULL::text AS email
  FROM public.partner_agencies a
  WHERE a.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.list_public_partner_agencies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_partner_agencies() TO anon, authenticated, service_role;

CREATE VIEW public.partner_agencies_public
WITH (security_invoker = on) AS
SELECT * FROM public.list_public_partner_agencies();

GRANT SELECT ON public.partner_agencies_public TO anon, authenticated, service_role;

-- 2) Scope catalog-vehicles public read to the image folders only
DROP POLICY IF EXISTS "Public read catalog-vehicles images" ON storage.objects;
CREATE POLICY "Public read catalog-vehicles images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'catalog-vehicles'
  AND (storage.foldername(name))[1] IN ('vehicles', 'icons')
);

-- 3) Hide lottery winner identity from the public
REVOKE SELECT (winner_user_id) ON public.wina_lotteries FROM anon, authenticated;

CREATE OR REPLACE VIEW public.wina_lotteries_public
WITH (security_invoker = on) AS
SELECT id, name, description, prize_label, image_url, draw_date,
       entry_cost_coins, min_vip_level_id, max_entries_per_user,
       status, created_at, updated_at
FROM public.wina_lotteries
WHERE status <> 'draft'::lottery_status;

GRANT SELECT ON public.wina_lotteries_public TO anon, authenticated, service_role;