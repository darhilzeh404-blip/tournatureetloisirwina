ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS service_amount integer
  GENERATED ALWAYS AS (GREATEST(COALESCE(total_amount,0)::integer - COALESCE((details->>'app_fees_total')::integer, 0), 0)) STORED;
COMMENT ON COLUMN public.reservations.service_amount IS 'Commercial amount of the service, excluding application fees (fees are never WINA revenue).';

DO $$
DECLARE _def text;
BEGIN
  SELECT pg_get_functiondef('public.complete_vtc_trip(uuid)'::regprocedure) INTO _def;
  _def := replace(_def, '_gross := COALESCE(_res.total_amount, 0);', '_gross := COALESCE(_res.service_amount, _res.total_amount, 0);');
  EXECUTE _def;
END $$;