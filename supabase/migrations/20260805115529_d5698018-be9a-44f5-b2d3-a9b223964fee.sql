GRANT SELECT ON public.schools TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;

GRANT SELECT ON public.school_routes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.school_routes TO authenticated;
GRANT ALL ON public.school_routes TO service_role;