CREATE TABLE IF NOT EXISTS public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.schools TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schools_public_read_active" ON public.schools
  FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "schools_admin_all" ON public.schools
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.school_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  departure_point TEXT NOT NULL DEFAULT '',
  arrival_point TEXT NOT NULL DEFAULT '',
  departure_time TEXT NOT NULL DEFAULT '',
  return_time TEXT NOT NULL DEFAULT '',
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.school_routes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_routes TO authenticated;
GRANT ALL ON public.school_routes TO service_role;

ALTER TABLE public.school_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_routes_public_read_active" ON public.school_routes
  FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "school_routes_admin_all" ON public.school_routes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS school_routes_school_id_idx ON public.school_routes(school_id);

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_school_routes_updated_at BEFORE UPDATE ON public.school_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();