
-- =========================================================
-- 1. group_ride_passengers : retirer l'exposition des
--    adresses précises aux autres passagers.
-- =========================================================
DROP POLICY IF EXISTS "Passengers view co-riders" ON public.group_ride_passengers;

CREATE OR REPLACE FUNCTION public.get_group_ride_co_passengers(_ride_id uuid)
RETURNS TABLE(
  id uuid,
  seat_index smallint,
  commune_pickup text,
  commune_destination text,
  status text,
  joined_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.seat_index, p.commune_pickup, p.commune_destination, p.status::text, p.joined_at
  FROM public.group_ride_passengers p
  WHERE p.ride_id = _ride_id
    AND public.is_group_ride_passenger(auth.uid(), _ride_id);
$$;

REVOKE ALL ON FUNCTION public.get_group_ride_co_passengers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_ride_co_passengers(uuid) TO authenticated;

-- =========================================================
-- 2. partner_agencies : protéger la colonne email
-- =========================================================
REVOKE SELECT (email) ON public.partner_agencies FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_partner_agency()
RETURNS SETOF public.partner_agencies
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.partner_agencies
  WHERE owner_user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_partner_agency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_partner_agency() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_all_partner_agencies_admin()
RETURNS SETOF public.partner_agencies
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY SELECT * FROM public.partner_agencies ORDER BY created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_all_partner_agencies_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_partner_agencies_admin() TO authenticated;

-- =========================================================
-- 3. drivers : politique SELECT explicite (rôle authenticated
--    uniquement, propre fiche + admins). Confirme le verrouillage.
-- =========================================================
DROP POLICY IF EXISTS "Drivers view own driver row" ON public.drivers;
CREATE POLICY "Drivers view own driver row"
ON public.drivers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
