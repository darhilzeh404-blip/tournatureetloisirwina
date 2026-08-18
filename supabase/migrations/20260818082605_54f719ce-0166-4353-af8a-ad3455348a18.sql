CREATE OR REPLACE FUNCTION public.block_vtc_reservations_while_dormant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_type = 'VTC'::service_type
     AND now() < timestamptz '2026-08-13 00:00:00+01'
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'VTC_SERVICE_UNAVAILABLE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_vtc_reservations ON public.reservations;
CREATE TRIGGER trg_block_vtc_reservations
BEFORE INSERT ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.block_vtc_reservations_while_dormant();