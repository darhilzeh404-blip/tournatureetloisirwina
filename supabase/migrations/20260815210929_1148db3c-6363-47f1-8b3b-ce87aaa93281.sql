REVOKE ALL ON FUNCTION public.compute_reservation_amount(service_type, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_reservation_amount(service_type, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.compute_reservation_amount(service_type, jsonb) FROM service_role;

REVOKE ALL ON FUNCTION public.enforce_reservation_amount() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_reservation_amount() FROM authenticated;
REVOKE ALL ON FUNCTION public.enforce_reservation_amount() FROM service_role;