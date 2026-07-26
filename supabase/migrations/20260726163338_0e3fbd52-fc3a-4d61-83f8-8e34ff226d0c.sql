-- 1. Commission rates: remove public read
DROP POLICY IF EXISTS "Public can read commission rates" ON public.partner_commission_rates;
REVOKE SELECT ON public.partner_commission_rates FROM anon;

-- 2. Bind helper functions to the calling user
CREATE OR REPLACE FUNCTION public.gerant_has_circuit(_user_id uuid, _circuit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_circuits uc
    WHERE uc.user_id = _user_id AND uc.circuit_id = _circuit_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.gerant_has_circuit_named(_user_id uuid, _name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_circuits uc
    JOIN public.circuits c ON c.id = uc.circuit_id
    WHERE uc.user_id = _user_id AND _name IS NOT NULL AND c.nom ILIKE _name
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_group_ride_passenger(_user_id uuid, _ride_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.group_ride_passengers
    WHERE ride_id = _ride_id AND user_id = _user_id AND status <> 'cancelled'
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_client_view_assigned_vtc_driver(_client_id uuid, _driver_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT _client_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.reservations r ON r.id = t.reservation_id
    WHERE t.client_id = _client_id
      AND t.driver_id = _driver_id
      AND t.archived_at IS NULL
      AND t.status IN ('assigned', 'active')
      AND r.service_type = 'VTC'::service_type
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_agency_owner(_user_id uuid, _agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.partner_agencies
    WHERE id = _agency_id AND owner_user_id = _user_id
  )
$function$;

-- 3. is_vtc_reservation: only expose to users related to the reservation or staff
CREATE OR REPLACE FUNCTION public.is_vtc_reservation(_reservation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = _reservation_id
      AND r.service_type = 'VTC'::service_type
      AND r.archived_at IS NULL
      AND (
        r.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'gerant'::app_role)
        OR public.has_role(auth.uid(), 'chauffeur'::app_role)
      )
  )
$function$;