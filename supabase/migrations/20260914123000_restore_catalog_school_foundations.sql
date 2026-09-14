-- Restores the missing administration foundations on the linked database.
-- Deliberately creates no business catalogue data: that must come from a
-- verified backup or be entered by an administrator.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.catalog_vehicle_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.catalog_vehicle_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  model text,
  year integer,
  seats integer,
  description text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_rate integer,
  rental_days integer NOT NULL DEFAULT 1,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '17:00',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_vehicles_daily_rate_check CHECK (daily_rate IS NULL OR daily_rate >= 0),
  CONSTRAINT catalog_vehicles_rental_days_check CHECK (rental_days > 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_vehicles_category ON public.catalog_vehicles(category_id);

CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  level text NOT NULL DEFAULT 'primaire' CHECK (level IN ('maternelle','primaire','college','lycee')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  departure_point text NOT NULL DEFAULT '',
  arrival_point text NOT NULL DEFAULT '',
  departure_time text NOT NULL DEFAULT '',
  return_time text NOT NULL DEFAULT '',
  monthly_price numeric NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_routes_school_id_idx ON public.school_routes(school_id);

ALTER TABLE public.catalog_vehicle_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_routes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.catalog_vehicle_categories, public.catalog_vehicles, public.schools, public.school_routes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_vehicle_categories, public.catalog_vehicles, public.schools, public.school_routes, public.school_monthly_tariffs, public.extra_activities TO authenticated;
GRANT ALL ON public.catalog_vehicle_categories, public.catalog_vehicles, public.schools, public.school_routes TO service_role;

DROP POLICY IF EXISTS "Public read active vehicle categories" ON public.catalog_vehicle_categories;
CREATE POLICY "Public read active vehicle categories" ON public.catalog_vehicle_categories FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage vehicle categories" ON public.catalog_vehicle_categories;
CREATE POLICY "Admins manage vehicle categories" ON public.catalog_vehicle_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public read active catalog vehicles" ON public.catalog_vehicles;
CREATE POLICY "Public read active catalog vehicles" ON public.catalog_vehicles FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage catalog vehicles" ON public.catalog_vehicles;
CREATE POLICY "Admins manage catalog vehicles" ON public.catalog_vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "schools_public_read_active" ON public.schools;
CREATE POLICY "schools_public_read_active" ON public.schools FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "schools_admin_all" ON public.schools;
CREATE POLICY "schools_admin_all" ON public.schools FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "school_routes_public_read_active" ON public.school_routes;
CREATE POLICY "school_routes_public_read_active" ON public.school_routes FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "school_routes_admin_all" ON public.school_routes;
CREATE POLICY "school_routes_admin_all" ON public.school_routes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS catalog_vehicle_categories_updated ON public.catalog_vehicle_categories;
CREATE TRIGGER catalog_vehicle_categories_updated BEFORE UPDATE ON public.catalog_vehicle_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS catalog_vehicles_updated ON public.catalog_vehicles;
CREATE TRIGGER catalog_vehicles_updated BEFORE UPDATE ON public.catalog_vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_schools_updated_at ON public.schools;
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_school_routes_updated_at ON public.school_routes;
CREATE TRIGGER update_school_routes_updated_at BEFORE UPDATE ON public.school_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
