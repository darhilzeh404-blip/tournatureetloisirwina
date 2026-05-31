DROP POLICY IF EXISTS "Drivers view assigned trips" ON public.trips;

CREATE POLICY "Drivers view assigned trips"
ON public.trips
FOR SELECT
TO public
USING (
  auth.uid() = driver_id
  AND has_role(auth.uid(), 'chauffeur'::app_role)
);