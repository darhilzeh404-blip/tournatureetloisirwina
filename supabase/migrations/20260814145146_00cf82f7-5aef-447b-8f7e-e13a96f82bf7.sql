ALTER TABLE public.boat_routes DROP CONSTRAINT boat_routes_agency_id_fkey,
  ADD CONSTRAINT boat_routes_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.partner_agencies(id) ON DELETE CASCADE;

ALTER TABLE public.vessels DROP CONSTRAINT vessels_agency_id_fkey,
  ADD CONSTRAINT vessels_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.partner_agencies(id) ON DELETE CASCADE;

ALTER TABLE public.flight_programs DROP CONSTRAINT flight_programs_agency_id_fkey,
  ADD CONSTRAINT flight_programs_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.partner_agencies(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.admin_delete_partner_agency(_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT name INTO _name FROM public.partner_agencies WHERE id = _agency_id;
  IF _name IS NULL THEN
    RAISE EXCEPTION 'Agence introuvable';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload)
  VALUES (auth.uid(), 'delete_partner_agency', 'partner_agencies', _agency_id,
          jsonb_build_object('name', _name));

  DELETE FROM public.partner_agencies WHERE id = _agency_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_partner_agency(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_partner_agency(uuid) TO authenticated;