
-- 1. Types de train
CREATE TABLE public.train_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  station_kind text NOT NULL DEFAULT 'principale' CHECK (station_kind IN ('principale','secondaire')),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.train_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_types TO authenticated;
GRANT ALL ON public.train_types TO service_role;
ALTER TABLE public.train_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_types_public_read" ON public.train_types FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "train_types_admin_all" ON public.train_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER train_types_updated_at BEFORE UPDATE ON public.train_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Gares
CREATE TABLE public.train_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  station_kind text NOT NULL DEFAULT 'principale' CHECK (station_kind IN ('principale','secondaire')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.train_stations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_stations TO authenticated;
GRANT ALL ON public.train_stations TO service_role;
ALTER TABLE public.train_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_stations_public_read" ON public.train_stations FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "train_stations_admin_all" ON public.train_stations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER train_stations_updated_at BEFORE UPDATE ON public.train_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Classes de voyage
CREATE TABLE public.train_travel_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.train_travel_classes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_travel_classes TO authenticated;
GRANT ALL ON public.train_travel_classes TO service_role;
ALTER TABLE public.train_travel_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_classes_public_read" ON public.train_travel_classes FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "train_classes_admin_all" ON public.train_travel_classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER train_classes_updated_at BEFORE UPDATE ON public.train_travel_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Règles de réduction
CREATE TABLE public.train_discount_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  applies_to text NOT NULL CHECK (applies_to IN ('main','child')),
  min_age integer,
  max_age integer,
  percent integer NOT NULL DEFAULT 50 CHECK (percent >= 0 AND percent <= 100),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.train_discount_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_discount_rules TO authenticated;
GRANT ALL ON public.train_discount_rules TO service_role;
ALTER TABLE public.train_discount_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_discounts_public_read" ON public.train_discount_rules FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "train_discounts_admin_all" ON public.train_discount_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER train_discounts_updated_at BEFORE UPDATE ON public.train_discount_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Billets: champs train
ALTER TABLE public.partner_tickets
  ADD COLUMN IF NOT EXISTS train_type_id uuid REFERENCES public.train_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_station_id uuid REFERENCES public.train_stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_station_id uuid REFERENCES public.train_stations(id) ON DELETE SET NULL;

-- 6. Tarifs par classe
CREATE TABLE public.train_ticket_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.partner_tickets(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.train_travel_classes(id) ON DELETE CASCADE,
  price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, class_id)
);
GRANT SELECT ON public.train_ticket_classes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_ticket_classes TO authenticated;
GRANT ALL ON public.train_ticket_classes TO service_role;
ALTER TABLE public.train_ticket_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_ticket_classes_public_read" ON public.train_ticket_classes FOR SELECT USING (true);
CREATE POLICY "train_ticket_classes_admin_all" ON public.train_ticket_classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER train_ticket_classes_updated_at BEFORE UPDATE ON public.train_ticket_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Suppression totale de la gestion des places
CREATE OR REPLACE FUNCTION public.partner_bookings_manage_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Données de référence
INSERT INTO public.train_types (name, code, station_kind, description, sort_order) VALUES
  ('Train Express', 'express', 'principale', 'Dessert uniquement les gares principales.', 1),
  ('Train Omnibus', 'omnibus', 'secondaire', 'Dessert uniquement les gares secondaires.', 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.train_travel_classes (name, code, sort_order) VALUES
  ('Deuxième Classe', 'seconde', 1),
  ('Première Classe', 'premiere', 2),
  ('VIP', 'vip', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.train_discount_rules (label, applies_to, min_age, max_age, percent, sort_order) VALUES
  ('Voyageur de 55 ans et plus', 'main', 55, NULL, 50, 1),
  ('Enfant de 4 à 11 ans', 'child', 4, 11, 50, 2);
