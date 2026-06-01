REVOKE EXECUTE ON FUNCTION public.is_vtc_reservation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_chauffeur_view_vtc_reservation(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_client_view_assigned_vtc_driver(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_nearby_vtc_drivers(numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_driver_search(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_vtc_trip(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_vtc_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_chauffeur_view_vtc_reservation(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_client_view_assigned_vtc_driver(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_nearby_vtc_drivers(numeric, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trigger_driver_search(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_vtc_trip(uuid) TO authenticated, service_role;