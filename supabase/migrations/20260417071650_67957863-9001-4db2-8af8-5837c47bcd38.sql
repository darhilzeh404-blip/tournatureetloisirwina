
-- ============ TABLES ============

CREATE TABLE public.transport_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🚌',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.transport_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  distance_km numeric(6,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transport_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL,
  base_price integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transport_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.transport_vehicles(id) ON DELETE CASCADE,
  service_type text NOT NULL DEFAULT 'standard',
  trip_type text NOT NULL DEFAULT 'aller_simple',
  price integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(route_id, vehicle_id, service_type, trip_type)
);

CREATE TABLE public.transport_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0,
  duration_hours numeric(4,1) NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transport_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.transport_activities(id) ON DELETE SET NULL,
  price integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transport_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value numeric(10,3) NOT NULL DEFAULT 1,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ RLS ============

ALTER TABLE public.transport_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_settings ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can view transport_categories" ON public.transport_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view transport_routes" ON public.transport_routes FOR SELECT USING (true);
CREATE POLICY "Anyone can view transport_vehicles" ON public.transport_vehicles FOR SELECT USING (true);
CREATE POLICY "Anyone can view transport_pricing" ON public.transport_pricing FOR SELECT USING (true);
CREATE POLICY "Anyone can view transport_activities" ON public.transport_activities FOR SELECT USING (true);
CREATE POLICY "Anyone can view transport_packages" ON public.transport_packages FOR SELECT USING (true);
CREATE POLICY "Anyone can view transport_settings" ON public.transport_settings FOR SELECT USING (true);

-- Admin write (loop via DO block)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transport_categories','transport_routes','transport_vehicles','transport_pricing','transport_activities','transport_packages','transport_settings']
  LOOP
    EXECUTE format('CREATE POLICY "Admins can insert %1$s" ON public.%1$s FOR INSERT WITH CHECK (has_role(auth.uid(), ''admin''::app_role))', t);
    EXECUTE format('CREATE POLICY "Admins can update %1$s" ON public.%1$s FOR UPDATE USING (has_role(auth.uid(), ''admin''::app_role))', t);
    EXECUTE format('CREATE POLICY "Admins can delete %1$s" ON public.%1$s FOR DELETE USING (has_role(auth.uid(), ''admin''::app_role))', t);
  END LOOP;
END$$;

-- ============ TRIGGERS updated_at ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transport_categories','transport_routes','transport_vehicles','transport_pricing','transport_activities','transport_packages','transport_settings']
  LOOP
    EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END$$;

-- ============ SEED DATA ============

INSERT INTO public.transport_categories (slug, name, description, icon, sort_order) VALUES
  ('scolaire', 'Transport scolaire & particulier', 'Trajets quotidiens pour enfants et particuliers', '🎒', 1),
  ('extra-scolaire', 'Extra-scolaire & activités éducatives', 'Transport + activités éducatives à la carte ou en forfait', '📚', 2),
  ('evenementiel', 'Événementiel (mariage, excursion, urbain)', 'Location de bus pour événements et excursions', '🎉', 3);

INSERT INTO public.transport_vehicles (name, capacity, base_price, description) VALUES
  ('Minibus 14 places', 14, 50000, 'Confortable, idéal trajets courts'),
  ('Bus 16 places', 16, 60000, 'Polyvalent, climatisé'),
  ('Grand bus 32 places', 32, 120000, 'Pour groupes et événements');

WITH cats AS (SELECT id, slug FROM public.transport_categories)
INSERT INTO public.transport_routes (category_id, name, origin, destination, distance_km)
SELECT c.id, r.name, r.origin, r.destination, r.distance_km FROM cats c, (VALUES
  ('scolaire',      'Akanda → Libreville',    'Akanda',    'Libreville', 15.0),
  ('scolaire',      'Owendo → Libreville',    'Owendo',    'Libreville', 12.0),
  ('extra-scolaire','Libreville → Akanda',    'Libreville','Akanda',     15.0),
  ('evenementiel',  'Libreville → Cap Estérias','Libreville','Cap Estérias', 35.0)
) AS r(slug, name, origin, destination, distance_km)
WHERE c.slug = r.slug;

INSERT INTO public.transport_activities (name, description, price, duration_hours) VALUES
  ('Atelier lecture',      'Lecture animée pour enfants',         3000, 1.5),
  ('Soutien scolaire',     'Aide aux devoirs encadrée',           5000, 2.0),
  ('Sortie pédagogique musée', 'Visite guidée du musée national', 7000, 3.0);

INSERT INTO public.transport_settings (key, value, label, description) VALUES
  ('vip_multiplier',       1.500, 'Multiplicateur VIP',          'Appliqué au prix de base pour service VIP'),
  ('round_trip_multiplier',1.800, 'Multiplicateur Aller-Retour', 'Appliqué pour un trajet aller-retour'),
  ('child_supplement',     500,   'Supplément par enfant (FCFA)','Ajouté par enfant pour transport scolaire');

-- Grille tarifaire de base : pour chaque (route, véhicule), 4 combinaisons (standard/VIP × aller/AR)
INSERT INTO public.transport_pricing (route_id, vehicle_id, service_type, trip_type, price)
SELECT r.id, v.id, st.service_type, tt.trip_type,
  CASE
    WHEN st.service_type = 'vip' AND tt.trip_type = 'aller_retour' THEN ROUND(v.base_price * 1.5 * 1.8)
    WHEN st.service_type = 'vip' THEN ROUND(v.base_price * 1.5)
    WHEN tt.trip_type = 'aller_retour' THEN ROUND(v.base_price * 1.8)
    ELSE v.base_price
  END
FROM public.transport_routes r
CROSS JOIN public.transport_vehicles v
CROSS JOIN (VALUES ('standard'), ('vip')) AS st(service_type)
CROSS JOIN (VALUES ('aller_simple'), ('aller_retour')) AS tt(trip_type);

INSERT INTO public.transport_packages (name, description, route_id, activity_id, price)
SELECT
  'Forfait ' || a.name || ' + transport',
  'Transport ' || r.name || ' inclus + ' || a.name,
  r.id, a.id,
  ROUND(a.price + 25000)
FROM public.transport_activities a
CROSS JOIN LATERAL (
  SELECT id, name FROM public.transport_routes
  WHERE category_id = (SELECT id FROM public.transport_categories WHERE slug = 'extra-scolaire')
  LIMIT 1
) r;
