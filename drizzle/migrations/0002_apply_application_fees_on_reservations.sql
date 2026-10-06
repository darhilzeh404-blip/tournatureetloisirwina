CREATE OR REPLACE FUNCTION public.apply_application_fees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _svc text;
  _base integer := COALESCE(NEW.total_amount, 0);
  _fees jsonb := '[]'::jsonb;
  _sum integer := 0;
  _f record;
  _amt integer;
BEGIN
  IF _base <= 0 OR (NEW.details ? 'app_fees') THEN RETURN NEW; END IF;
  _svc := CASE NEW.service_type::text
    WHEN 'TRANSPORT_SCOLAIRE' THEN 'SCOLAIRE'
    WHEN 'LOCATION_BUS' THEN 'BUS'
    WHEN 'CIRCUIT_TOURISTIQUE' THEN 'CIRCUIT'
    WHEN 'LOCATION_CATALOGUE' THEN 'LOCATION'
    ELSE NEW.service_type::text END;
  FOR _f IN SELECT name, fee_type, amount FROM public.application_fees
            WHERE is_active AND (service_type IS NULL OR service_type = _svc) LOOP
    _amt := CASE WHEN _f.fee_type = 'percentage' THEN round(_base * _f.amount / 100.0)::int ELSE round(_f.amount)::int END;
    IF _amt > 0 THEN
      _sum := _sum + _amt;
      _fees := _fees || jsonb_build_object('name', _f.name, 'amount', _amt);
    END IF;
  END LOOP;
  IF _sum > 0 THEN
    NEW.details := COALESCE(NEW.details, '{}'::jsonb) || jsonb_build_object('base_amount', _base, 'app_fees', _fees, 'app_fees_total', _sum);
    NEW.total_amount := _base + _sum;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_application_fees() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_apply_application_fees ON public.reservations;
CREATE TRIGGER zz_apply_application_fees BEFORE INSERT ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.apply_application_fees();