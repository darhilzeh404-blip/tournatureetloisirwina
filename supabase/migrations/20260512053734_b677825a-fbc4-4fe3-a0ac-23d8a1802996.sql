-- Normalize existing data first to avoid index creation failures
UPDATE public.drivers
SET license_plate = UPPER(REGEXP_REPLACE(COALESCE(license_plate, ''), '[^A-Za-z0-9]', '', 'g'))
WHERE license_plate IS NOT NULL;

UPDATE public.drivers
SET phone = NULLIF(REGEXP_REPLACE(COALESCE(phone, ''), '\s', '', 'g'), '')
WHERE phone IS NOT NULL;

-- Unique index on license_plate (case-insensitive, normalized form already stored)
CREATE UNIQUE INDEX IF NOT EXISTS drivers_license_plate_unique
  ON public.drivers (license_plate)
  WHERE license_plate IS NOT NULL AND license_plate <> '';

-- Unique index on phone (only when present)
CREATE UNIQUE INDEX IF NOT EXISTS drivers_phone_unique
  ON public.drivers (phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- Validation trigger to enforce normalization at write time
CREATE OR REPLACE FUNCTION public.normalize_driver_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.license_plate IS NOT NULL THEN
    NEW.license_plate := UPPER(REGEXP_REPLACE(NEW.license_plate, '[^A-Za-z0-9]', '', 'g'));
    IF NEW.license_plate = '' THEN
      RAISE EXCEPTION 'license_plate invalide';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL THEN
    NEW.phone := REGEXP_REPLACE(NEW.phone, '\s', '', 'g');
    IF NEW.phone = '' THEN
      NEW.phone := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drivers_normalize_fields ON public.drivers;
CREATE TRIGGER drivers_normalize_fields
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_driver_fields();