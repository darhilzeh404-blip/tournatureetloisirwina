CREATE OR REPLACE FUNCTION public.enforce_partner_agency_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.is_verified := OLD.is_verified;
  NEW.commission_percent := OLD.commission_percent;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_agencies_admin_fields ON public.partner_agencies;
CREATE TRIGGER trg_partner_agencies_admin_fields
BEFORE UPDATE ON public.partner_agencies
FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_agency_admin_fields();

CREATE OR REPLACE FUNCTION public.enforce_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.archived_at := OLD.archived_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_admin_fields ON public.profiles;
CREATE TRIGGER trg_profiles_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_admin_fields();

REVOKE EXECUTE ON FUNCTION public.enforce_partner_agency_admin_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_admin_fields() FROM PUBLIC, anon, authenticated;