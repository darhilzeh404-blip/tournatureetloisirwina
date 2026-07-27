-- 1. Dessertes
CREATE TABLE public.train_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  train_type_id uuid NOT NULL REFERENCES public.train_types(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.train_routes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_routes TO authenticated;
GRANT ALL ON public.train_routes TO service_role;
ALTER TABLE public.train_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_routes_public_read" ON public.train_routes FOR SELECT USING (true);
CREATE POLICY "train_routes_admin_write" ON public.train_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.train_route_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.train_routes(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.train_stations(id) ON DELETE CASCADE,
  stop_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, station_id)
);
GRANT SELECT ON public.train_route_stations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_route_stations TO authenticated;
GRANT ALL ON public.train_route_stations TO service_role;
ALTER TABLE public.train_route_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_route_stations_public_read" ON public.train_route_stations FOR SELECT USING (true);
CREATE POLICY "train_route_stations_admin_write" ON public.train_route_stations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Règles bagages
CREATE TABLE public.train_baggage_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  train_type_id uuid REFERENCES public.train_types(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Bagages',
  conditions text NOT NULL DEFAULT '',
  free_count integer NOT NULL DEFAULT 1,
  fee_per_extra numeric NOT NULL DEFAULT 0,
  max_count integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.train_baggage_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_baggage_rules TO authenticated;
GRANT ALL ON public.train_baggage_rules TO service_role;
ALTER TABLE public.train_baggage_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_baggage_rules_public_read" ON public.train_baggage_rules FOR SELECT USING (true);
CREATE POLICY "train_baggage_rules_admin_write" ON public.train_baggage_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Colonnes réservation
ALTER TABLE public.partner_bookings
  ADD COLUMN IF NOT EXISTS departure_date date,
  ADD COLUMN IF NOT EXISTS station_from_id uuid REFERENCES public.train_stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS station_to_id uuid REFERENCES public.train_stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS travel_class_id uuid REFERENCES public.train_travel_classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baggage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baggage_fee numeric NOT NULL DEFAULT 0;

-- 4. Voyageurs
CREATE TABLE public.train_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.partner_bookings(id) ON DELETE CASCADE,
  last_name text NOT NULL,
  first_name text NOT NULL,
  phone text,
  email text,
  age integer,
  id_document_type text NOT NULL DEFAULT 'cni',
  id_document_number text,
  id_document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT train_passengers_doc_type_check CHECK (id_document_type IN ('cni','passeport','carte_sejour'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_passengers TO authenticated;
GRANT ALL ON public.train_passengers TO service_role;
ALTER TABLE public.train_passengers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_passengers_owner_all" ON public.train_passengers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.partner_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
CREATE POLICY "train_passengers_admin_all" ON public.train_passengers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Enfants
CREATE TABLE public.train_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.partner_bookings(id) ON DELETE CASCADE,
  last_name text NOT NULL,
  first_name text NOT NULL,
  age integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT train_children_age_check CHECK (age >= 4 AND age <= 11)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_children TO authenticated;
GRANT ALL ON public.train_children TO service_role;
ALTER TABLE public.train_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_children_owner_all" ON public.train_children FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.partner_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
CREATE POLICY "train_children_admin_all" ON public.train_children FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Triggers updated_at
CREATE TRIGGER train_routes_set_updated_at BEFORE UPDATE ON public.train_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER train_baggage_rules_set_updated_at BEFORE UPDATE ON public.train_baggage_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER train_passengers_set_updated_at BEFORE UPDATE ON public.train_passengers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();