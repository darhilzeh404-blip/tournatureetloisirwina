
-- ============================================================
-- BLOC 4 : Fix upload — élargir aux gérants sur les buckets existants
-- ============================================================

DROP POLICY IF EXISTS "Admins can upload circuit images" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload circuit-images" ON storage.objects;
CREATE POLICY "Staff upload circuit-images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'circuit-images'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant'))
  );

DROP POLICY IF EXISTS "Admins can update circuit images" ON storage.objects;
CREATE POLICY "Staff update circuit-images" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'circuit-images'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant'))
  );

DROP POLICY IF EXISTS "Admins can delete circuit images" ON storage.objects;
CREATE POLICY "Staff delete circuit-images" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'circuit-images'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant'))
  );

DROP POLICY IF EXISTS "Admins upload ticket-images" ON storage.objects;
CREATE POLICY "Staff upload ticket-images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-images'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant') OR has_role(auth.uid(), 'agence'))
  );

DROP POLICY IF EXISTS "Admins update ticket-images" ON storage.objects;
CREATE POLICY "Staff update ticket-images" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ticket-images'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant') OR has_role(auth.uid(), 'agence'))
  );

DROP POLICY IF EXISTS "Admins delete ticket-images" ON storage.objects;
CREATE POLICY "Staff delete ticket-images" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-images'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant'))
  );

-- ============================================================
-- BLOC 3 : Catégorie sur partner_agencies
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.agency_category AS ENUM ('bus', 'train', 'avion', 'bateau');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.partner_agencies
  ADD COLUMN IF NOT EXISTS category public.agency_category;

-- ============================================================
-- BLOC 5 : Table tourist_sites
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tourist_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  location TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  images TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tourist_sites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tourist_sites TO authenticated;
GRANT ALL ON public.tourist_sites TO service_role;

ALTER TABLE public.tourist_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active tourist sites" ON public.tourist_sites;
CREATE POLICY "Public read active tourist sites" ON public.tourist_sites
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant'));

DROP POLICY IF EXISTS "Staff manage tourist sites" ON public.tourist_sites;
CREATE POLICY "Staff manage tourist sites" ON public.tourist_sites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerant'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tourist_sites_updated ON public.tourist_sites;
CREATE TRIGGER trg_tourist_sites_updated BEFORE UPDATE ON public.tourist_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
