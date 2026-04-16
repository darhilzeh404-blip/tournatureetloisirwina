
DROP VIEW IF EXISTS public.rides_gerant;
CREATE VIEW public.rides_gerant WITH (security_invoker = on) AS
SELECT id, pickup, destination, status, driver_id, created_by, scheduled_at, notes, created_at, updated_at
FROM public.rides;
