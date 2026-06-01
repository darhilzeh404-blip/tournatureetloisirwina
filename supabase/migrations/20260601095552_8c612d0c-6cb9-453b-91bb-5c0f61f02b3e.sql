GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.find_nearby_vtc_drivers(numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_driver_search(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_vtc_trip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vtc_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_chauffeur_view_vtc_reservation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_client_view_assigned_vtc_driver(uuid, uuid) TO authenticated;