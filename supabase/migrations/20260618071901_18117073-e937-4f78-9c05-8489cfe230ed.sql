
-- Harden the trips UPDATE policy for drivers:
-- * forbid changing the assigned driver (driver_id stable)
-- * forbid touching archived trips
-- * restrict status transitions to the in-flight lifecycle
DROP POLICY IF EXISTS "Drivers update assigned trips" ON public.trips;

CREATE POLICY "Drivers update assigned trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id
  AND public.has_role(auth.uid(), 'chauffeur'::app_role)
  AND archived_at IS NULL
  AND status IN ('pending', 'assigned', 'active')
)
WITH CHECK (
  auth.uid() = driver_id
  AND public.has_role(auth.uid(), 'chauffeur'::app_role)
  AND status IN ('assigned', 'active', 'completed')
);

-- Harden gerant updates similarly
DROP POLICY IF EXISTS "Gerants update assigned trips" ON public.trips;

CREATE POLICY "Gerants update assigned trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  auth.uid() = gerant_id
  AND public.has_role(auth.uid(), 'gerant'::app_role)
  AND archived_at IS NULL
)
WITH CHECK (
  auth.uid() = gerant_id
  AND public.has_role(auth.uid(), 'gerant'::app_role)
);
