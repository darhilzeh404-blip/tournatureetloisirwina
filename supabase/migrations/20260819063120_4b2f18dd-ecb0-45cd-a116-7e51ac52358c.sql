CREATE OR REPLACE FUNCTION public.block_vtc_reservations_while_dormant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type = 'VTC'::service_type
     AND now() < timestamptz '2026-09-02 00:00:00+01'
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'VTC_SERVICE_UNAVAILABLE';
  END IF;
  RETURN NEW;
END;
$$;