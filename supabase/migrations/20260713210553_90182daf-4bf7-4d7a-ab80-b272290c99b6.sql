
CREATE TABLE public.catalog_vehicle_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalog_vehicle_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_vehicle_categories TO authenticated;
GRANT ALL ON public.catalog_vehicle_categories TO service_role;

ALTER TABLE public.catalog_vehicle_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active vehicle categories"
  ON public.catalog_vehicle_categories FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage vehicle categories"
  ON public.catalog_vehicle_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.catalog_vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.catalog_vehicle_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  model text,
  year integer,
  seats integer,
  description text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalog_vehicles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_vehicles TO authenticated;
GRANT ALL ON public.catalog_vehicles TO service_role;

ALTER TABLE public.catalog_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active catalog vehicles"
  ON public.catalog_vehicles FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage catalog vehicles"
  ON public.catalog_vehicles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_catalog_vehicles_category ON public.catalog_vehicles(category_id);

CREATE TRIGGER catalog_vehicle_categories_updated
  BEFORE UPDATE ON public.catalog_vehicle_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER catalog_vehicles_updated
  BEFORE UPDATE ON public.catalog_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
