DROP POLICY IF EXISTS "Authenticated users can view buses" ON public.buses;
DROP POLICY IF EXISTS "Chauffeurs can view their assigned buses" ON public.buses;

CREATE POLICY "Staff can view buses" ON public.buses
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerant'::app_role)
  OR has_role(auth.uid(), 'chauffeur'::app_role)
);