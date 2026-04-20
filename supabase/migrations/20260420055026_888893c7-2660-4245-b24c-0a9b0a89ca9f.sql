-- 1. Étendre la table circuits
ALTER TABLE public.circuits
  ADD COLUMN IF NOT EXISTS base_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS includes_lodging boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS includes_guide boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lodging_price integer NOT NULL DEFAULT 15000,
  ADD COLUMN IF NOT EXISTS guide_price integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Slug par défaut pour les lignes existantes sans slug, puis contrainte unique réelle
UPDATE public.circuits
   SET slug = 'circuit-' || substr(id::text, 1, 8)
 WHERE slug IS NULL;

ALTER TABLE public.circuits ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'circuits_slug_key'
  ) THEN
    ALTER TABLE public.circuits ADD CONSTRAINT circuits_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 2. Table circuit_activities
CREATE TABLE IF NOT EXISTS public.circuit_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circuit_id uuid NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circuit_activities_circuit_id_idx ON public.circuit_activities(circuit_id);

ALTER TABLE public.circuit_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'circuit_activities' AND policyname = 'Anyone can view circuit_activities') THEN
    CREATE POLICY "Anyone can view circuit_activities" ON public.circuit_activities FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'circuit_activities' AND policyname = 'Admins can insert circuit_activities') THEN
    CREATE POLICY "Admins can insert circuit_activities" ON public.circuit_activities FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'circuit_activities' AND policyname = 'Admins can update circuit_activities') THEN
    CREATE POLICY "Admins can update circuit_activities" ON public.circuit_activities FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'circuit_activities' AND policyname = 'Admins can delete circuit_activities') THEN
    CREATE POLICY "Admins can delete circuit_activities" ON public.circuit_activities FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 3. Seed des circuits
INSERT INTO public.circuits (slug, nom, description, base_price, duration_days, includes_lodging, includes_guide, sort_order) VALUES
  ('raponda-walker', 'Arboretum Raponda Walker', 'Arboretum botanique et randonnée nature', 10000, 1, false, false, 10),
  ('baie-mondah', 'Baie de la Mondah', 'Mangroves, baignade et buffet local', 20000, 1, false, false, 20),
  ('akouagho-village', 'Akouagho Village', 'Immersion culturelle, baignade et buffet', 25000, 1, false, true, 30),
  ('boulokoboue', 'Site Boulokoboué', 'Culture, baignade et buffet en pleine nature', 25000, 1, false, true, 40),
  ('cap-caravane', 'Cap Caravane', 'Restaurant flottant, baignade et dance party', 35000, 1, false, false, 50),
  ('ndossi-village', 'Ndossi Village', 'Kayak, pêche, ski nautique, culture et buffet', 45000, 1, true, true, 60),
  ('visite-iles-akanda', 'Visite des Îles (Akanda)', 'Navette aller-retour vers les îles du parc d''Akanda', 30000, 1, false, true, 70),
  ('randonnee-akanda', 'Randonnée Parc d''Akanda', 'Randonnée guidée dans le parc national d''Akanda', 20000, 1, false, true, 80),
  ('pongara-traversee', 'Pongara — Traversée', 'Traversée aller-retour vers le parc national de Pongara', 25000, 1, false, false, 90),
  ('pongara-randonnee', 'Pongara — Randonnée & Culture', 'Randonnée, immersion culturelle et soirée dance', 35000, 1, false, true, 100),
  ('pongara-visite-parc', 'Pongara — Visite du parc', 'Visite guidée du parc national de Pongara', 40000, 1, false, true, 110),
  ('pongara-safari', 'Pongara — Safari', 'Safari faune sauvage dans le parc de Pongara', 60000, 1, false, true, 120),
  ('pongara-baignade', 'Pongara — Baignade & activités', 'Plage paradisiaque et activités aquatiques', 40000, 1, false, false, 130),
  ('wonga-wongue', 'Réserve de Wonga Wonguè', 'Traversée AR, hébergement, culture, safari et baignade', 120000, 2, true, true, 140),
  ('chute-meyang', 'Chute de Meyang', 'Transport AR, randonnée, baignade, culture et buffet', 50000, 1, false, true, 150),
  ('cocobeach', 'Site de Cocobeach', 'Transport AR, excursions, baignade, culture et buffet', 55000, 1, false, true, 160)
ON CONFLICT (slug) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  duration_days = EXCLUDED.duration_days,
  includes_lodging = EXCLUDED.includes_lodging,
  includes_guide = EXCLUDED.includes_guide,
  sort_order = EXCLUDED.sort_order;

-- 4. Seed des activités liées
DELETE FROM public.circuit_activities
WHERE circuit_id IN (SELECT id FROM public.circuits WHERE slug IN (
  'baie-mondah','akouagho-village','boulokoboue','cap-caravane','ndossi-village',
  'pongara-randonnee','pongara-baignade','wonga-wongue','chute-meyang','cocobeach'
));

INSERT INTO public.circuit_activities (circuit_id, name, price, is_default, sort_order)
SELECT c.id, x.name, x.price, x.is_default, x.sort_order
FROM public.circuits c
JOIN (VALUES
  ('baie-mondah', 'Baignade', 0, true, 1),
  ('baie-mondah', 'Buffet local', 5000, true, 2),
  ('akouagho-village', 'Visite culturelle', 0, true, 1),
  ('akouagho-village', 'Baignade', 0, true, 2),
  ('akouagho-village', 'Buffet local', 5000, true, 3),
  ('boulokoboue', 'Visite culturelle', 0, true, 1),
  ('boulokoboue', 'Baignade', 0, true, 2),
  ('boulokoboue', 'Buffet local', 5000, true, 3),
  ('cap-caravane', 'Restaurant flottant', 8000, true, 1),
  ('cap-caravane', 'Baignade', 0, true, 2),
  ('cap-caravane', 'Dance party', 5000, false, 3),
  ('ndossi-village', 'Kayak', 7000, false, 1),
  ('ndossi-village', 'Pêche', 6000, false, 2),
  ('ndossi-village', 'Ski nautique', 10000, false, 3),
  ('ndossi-village', 'Baignade', 0, true, 4),
  ('ndossi-village', 'Visite culturelle', 0, true, 5),
  ('ndossi-village', 'Dance party', 5000, false, 6),
  ('ndossi-village', 'Buffet local', 5000, true, 7),
  ('pongara-randonnee', 'Randonnée', 0, true, 1),
  ('pongara-randonnee', 'Visite culturelle', 0, true, 2),
  ('pongara-randonnee', 'Dance party', 5000, false, 3),
  ('pongara-baignade', 'Baignade', 0, true, 1),
  ('pongara-baignade', 'Activités plage', 5000, false, 2),
  ('wonga-wongue', 'Visite culturelle', 0, true, 1),
  ('wonga-wongue', 'Safari', 15000, true, 2),
  ('wonga-wongue', 'Baignade', 0, true, 3),
  ('wonga-wongue', 'Buffet local', 8000, true, 4),
  ('chute-meyang', 'Randonnée', 0, true, 1),
  ('chute-meyang', 'Baignade', 0, true, 2),
  ('chute-meyang', 'Visite culturelle', 0, true, 3),
  ('chute-meyang', 'Buffet local', 5000, true, 4),
  ('cocobeach', 'Excursion bateau', 8000, true, 1),
  ('cocobeach', 'Baignade', 0, true, 2),
  ('cocobeach', 'Visite culturelle', 0, true, 3),
  ('cocobeach', 'Buffet local', 5000, true, 4)
) AS x(slug, name, price, is_default, sort_order) ON x.slug = c.slug;