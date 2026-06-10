
-- 1) school_trip_tariffs
CREATE TABLE public.school_trip_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_label text NOT NULL,
  standing text NOT NULL CHECK (standing IN ('standard','vip')),
  formule text NOT NULL CHECK (formule IN ('simple','ar')),
  amount integer NOT NULL CHECK (amount >= 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_label, standing, formule)
);
GRANT SELECT ON public.school_trip_tariffs TO anon, authenticated;
GRANT ALL ON public.school_trip_tariffs TO service_role;
ALTER TABLE public.school_trip_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_trip_tariffs read" ON public.school_trip_tariffs FOR SELECT USING (true);
CREATE POLICY "school_trip_tariffs admin write" ON public.school_trip_tariffs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_school_trip_tariffs_updated BEFORE UPDATE ON public.school_trip_tariffs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) school_monthly_tariffs
CREATE TABLE public.school_monthly_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standing text NOT NULL CHECK (standing IN ('standard','vip')),
  formule text NOT NULL CHECK (formule IN ('simple','ar')),
  amount integer NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (standing, formule)
);
GRANT SELECT ON public.school_monthly_tariffs TO anon, authenticated;
GRANT ALL ON public.school_monthly_tariffs TO service_role;
ALTER TABLE public.school_monthly_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_monthly_tariffs read" ON public.school_monthly_tariffs FOR SELECT USING (true);
CREATE POLICY "school_monthly_tariffs admin write" ON public.school_monthly_tariffs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_school_monthly_tariffs_updated BEFORE UPDATE ON public.school_monthly_tariffs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) extra_activities
CREATE TABLE public.extra_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text,
  price integer NOT NULL CHECK (price >= 0),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.extra_activities TO anon, authenticated;
GRANT ALL ON public.extra_activities TO service_role;
ALTER TABLE public.extra_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extra_activities read" ON public.extra_activities FOR SELECT USING (true);
CREATE POLICY "extra_activities admin write" ON public.extra_activities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_extra_activities_updated BEFORE UPDATE ON public.extra_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) group_bus_trips
CREATE TABLE public.group_bus_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  gathering text NOT NULL,
  note text,
  destinations text[] NOT NULL DEFAULT '{}',
  pricing jsonb NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.group_bus_trips TO anon, authenticated;
GRANT ALL ON public.group_bus_trips TO service_role;
ALTER TABLE public.group_bus_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_bus_trips read" ON public.group_bus_trips FOR SELECT USING (true);
CREATE POLICY "group_bus_trips admin write" ON public.group_bus_trips FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_group_bus_trips_updated BEFORE UPDATE ON public.group_bus_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) event_bus_tariffs
CREATE TABLE public.event_bus_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standing text NOT NULL CHECK (standing IN ('standard','vip')),
  formule text NOT NULL CHECK (formule IN ('journee','demi')),
  amount integer NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (standing, formule)
);
GRANT SELECT ON public.event_bus_tariffs TO anon, authenticated;
GRANT ALL ON public.event_bus_tariffs TO service_role;
ALTER TABLE public.event_bus_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_bus_tariffs read" ON public.event_bus_tariffs FOR SELECT USING (true);
CREATE POLICY "event_bus_tariffs admin write" ON public.event_bus_tariffs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_event_bus_tariffs_updated BEFORE UPDATE ON public.event_bus_tariffs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) event_bus_capacity_factors
CREATE TABLE public.event_bus_capacity_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capacity integer NOT NULL UNIQUE CHECK (capacity > 0),
  factor numeric(4,2) NOT NULL CHECK (factor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_bus_capacity_factors TO anon, authenticated;
GRANT ALL ON public.event_bus_capacity_factors TO service_role;
ALTER TABLE public.event_bus_capacity_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_bus_capacity_factors read" ON public.event_bus_capacity_factors FOR SELECT USING (true);
CREATE POLICY "event_bus_capacity_factors admin write" ON public.event_bus_capacity_factors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_event_bus_capacity_factors_updated BEFORE UPDATE ON public.event_bus_capacity_factors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) transport_misc_settings
CREATE TABLE public.transport_misc_settings (
  key text PRIMARY KEY,
  value_int integer NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transport_misc_settings TO anon, authenticated;
GRANT ALL ON public.transport_misc_settings TO service_role;
ALTER TABLE public.transport_misc_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_misc_settings read" ON public.transport_misc_settings FOR SELECT USING (true);
CREATE POLICY "transport_misc_settings admin write" ON public.transport_misc_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_transport_misc_settings_updated BEFORE UPDATE ON public.transport_misc_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED DATA ============

-- school_trip_tariffs (from tarifs.tsx)
INSERT INTO public.school_trip_tariffs (route_label, standing, formule, amount, sort_order) VALUES
  ('Akanda — Libreville', 'standard', 'ar', 80000, 1),
  ('Akanda — Libreville', 'standard', 'simple', 50000, 1),
  ('Akanda — Libreville', 'vip', 'ar', 150000, 1),
  ('Akanda — Libreville', 'vip', 'simple', 80000, 1),
  ('Owendo — Libreville', 'standard', 'ar', 80000, 2),
  ('Owendo — Libreville', 'standard', 'simple', 50000, 2),
  ('Owendo — Libreville', 'vip', 'ar', 150000, 2),
  ('Owendo — Libreville', 'vip', 'simple', 80000, 2);

-- school_monthly_tariffs (from reserver-transport.tsx)
INSERT INTO public.school_monthly_tariffs (standing, formule, amount) VALUES
  ('standard', 'simple', 80000),
  ('standard', 'ar', 120000),
  ('vip', 'simple', 150000),
  ('vip', 'ar', 220000);

-- extra_activities
INSERT INTO public.extra_activities (code, label, emoji, price, sort_order) VALUES
  ('jardinage', 'Jardinage fruits & légumes', '🌱', 15000, 1),
  ('culinaire', 'Art culinaire', '👨‍🍳', 18000, 2),
  ('nutrition', 'Nutrition saine', '🥗', 12000, 3),
  ('nature', 'Nature & culture', '🌳', 20000, 4),
  ('natation', 'Natation & danse', '🏊', 25000, 5);

-- group_bus_trips
INSERT INTO public.group_bus_trips (code, title, gathering, note, destinations, pricing, sort_order) VALUES
  ('parc-akanda', 'Trajet Parc d''Akanda', 'Parking SANgel',
    'Aller et retour facturés séparément pour les déplacements en groupe.',
    ARRAY['Cap Santa-Clara','Cap Estérias','Cap des Pères','Cap Caravane','Boulokoboué','Malibé 1','Malibé 2','Ndossi village','Akouago-village'],
    '{"type":"direction","aller":20000,"retour":20000}'::jsonb, 1),
  ('lbv-donguila', 'LBV - Donguila', 'ABC Mall des Charbonnages', NULL,
    ARRAY['LBV - Donguila'],
    '{"type":"daily","byCapacity":{"16":100000,"24":150000,"32":200000}}'::jsonb, 2),
  ('lbv-meyang', 'LBV - Meyang', 'ABC Mall des Charbonnages', NULL,
    ARRAY['LBV - Meyang'],
    '{"type":"daily","byCapacity":{"16":100000,"24":150000,"32":200000}}'::jsonb, 3),
  ('cocobeach', 'LBV - Cocobeach', 'ABC Mall des Charbonnages', NULL,
    ARRAY['LBV - Cocobeach'],
    '{"type":"daily","byCapacity":{"16":192000,"24":288000,"32":384000}}'::jsonb, 4);

-- event_bus_tariffs
INSERT INTO public.event_bus_tariffs (standing, formule, amount) VALUES
  ('standard', 'journee', 180000),
  ('standard', 'demi', 100000),
  ('vip', 'journee', 250000),
  ('vip', 'demi', 130000);

-- event_bus_capacity_factors
INSERT INTO public.event_bus_capacity_factors (capacity, factor) VALUES
  (14, 0.60),
  (16, 0.70),
  (24, 0.85),
  (32, 1.00);

-- transport_misc_settings
INSERT INTO public.transport_misc_settings (key, value_int, label) VALUES
  ('extra_transport_fee', 10000, 'Frais de transport pour activité extra-scolaire (par enfant)');
