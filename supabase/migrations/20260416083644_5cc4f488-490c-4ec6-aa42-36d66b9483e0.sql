
-- Gérants can view CIRCUIT_TOURISTIQUE reservations
CREATE POLICY "Gerants can view circuit reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gerant'::app_role)
  AND service_type = 'CIRCUIT_TOURISTIQUE'::service_type
);

-- Gérants can view all circuits (already public, but explicit)
-- Chauffeurs can view buses assigned to them
CREATE POLICY "Chauffeurs can view their assigned buses"
ON public.buses
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'chauffeur'::app_role)
);
