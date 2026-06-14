
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS agent_code text;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_reference_code_key
  ON public.reservations(reference_code) WHERE reference_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_reservation_codes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _svc text := NEW.service_type::text;
  _ref text;
  _try int := 0;
BEGIN
  IF _svc NOT IN ('LOCATION_BUS','TRANSPORT_SCOLAIRE','ACTIVITE','BILLET','CIRCUIT_TOURISTIQUE') THEN
    RETURN NEW;
  END IF;

  IF NEW.reference_code IS NULL THEN
    LOOP
      _ref := lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.reservations WHERE reference_code = _ref);
      _try := _try + 1;
      IF _try > 10 THEN
        _ref := lpad((floor(random() * 900000000) + 100000000)::bigint::text, 9, '0');
        EXIT;
      END IF;
    END LOOP;
    NEW.reference_code := _ref;
  END IF;

  IF NEW.agent_code IS NULL THEN
    NEW.agent_code := lpad((floor(random() * 900000) + 100000)::bigint::text, 6, '0');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_generate_reservation_codes ON public.reservations;
CREATE TRIGGER trg_generate_reservation_codes
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.generate_reservation_codes();

-- Backfill existing rows
UPDATE public.reservations
  SET reference_code = lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0'),
      agent_code = lpad((floor(random() * 900000) + 100000)::bigint::text, 6, '0')
  WHERE reference_code IS NULL
    AND service_type::text IN ('LOCATION_BUS','TRANSPORT_SCOLAIRE','ACTIVITE','BILLET','CIRCUIT_TOURISTIQUE');
