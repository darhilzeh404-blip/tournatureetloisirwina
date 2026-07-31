DROP POLICY IF EXISTS train_routes_public_read ON public.train_routes;
CREATE POLICY train_routes_public_read ON public.train_routes
FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS train_route_stations_public_read ON public.train_route_stations;
CREATE POLICY train_route_stations_public_read ON public.train_route_stations
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.train_routes r WHERE r.id = route_id AND r.is_active)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS train_ticket_classes_public_read ON public.train_ticket_classes;
CREATE POLICY train_ticket_classes_public_read ON public.train_ticket_classes
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partner_tickets t WHERE t.id = ticket_id AND t.is_active)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);