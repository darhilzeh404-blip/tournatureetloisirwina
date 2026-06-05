CREATE OR REPLACE FUNCTION public.get_driver_vtc_earnings(_driver_id uuid)
 RETURNS TABLE(payment_id uuid, trip_id uuid, reservation_id uuid, amount integer, validated_at timestamp with time zone, completed_at timestamp with time zone, trip_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF auth.uid() <> _driver_id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
    SELECT p.id, t.id, r.id, p.amount, p.updated_at, t.completed_at, t.status::text
    FROM public.payments p
    JOIN public.reservations r ON r.id = p.reservation_id
    JOIN public.trips t ON t.reservation_id = r.id
    WHERE t.driver_id = _driver_id
      AND r.service_type = 'VTC'::service_type
      AND p.status = 'VALIDATED';
END;
$function$;