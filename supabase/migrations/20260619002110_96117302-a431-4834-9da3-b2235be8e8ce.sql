
-- =========================================================
-- 1) PARTNER AGENCIES: stop exposing email/phone publicly
-- =========================================================
DROP POLICY IF EXISTS "Anyone views verified active agencies" ON public.partner_agencies;

-- Allow only authenticated users to read full rows (still restricted to active OR own OR admin)
CREATE POLICY "Authenticated view active or own agencies"
  ON public.partner_agencies
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR owner_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Public-safe view exposing only non-sensitive columns
CREATE OR REPLACE VIEW public.partner_agencies_public
WITH (security_invoker = true) AS
SELECT id, name, logo_url, is_active
FROM public.partner_agencies
WHERE is_active = true;

-- The view inherits RLS via security_invoker, but we want truly public read
-- Add a permissive SELECT policy for anon/authenticated restricted to active rows.
DROP POLICY IF EXISTS "Public can view active agencies (safe cols)" ON public.partner_agencies;
CREATE POLICY "Public can view active agencies (safe cols)"
  ON public.partner_agencies
  FOR SELECT
  TO anon
  USING (false); -- anon CANNOT select directly from base table

GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;

-- =========================================================
-- 2) RESERVATIONS: remove chauffeur direct SELECT, expose
--    safe data via SECURITY DEFINER functions only.
-- =========================================================
DROP POLICY IF EXISTS "Chauffeurs view VTC trip reservations" ON public.reservations;

CREATE OR REPLACE FUNCTION public.get_chauffeur_vtc_active_trips()
RETURNS TABLE(
  id uuid,
  reservation_id uuid,
  client_id uuid,
  driver_id uuid,
  origin_address text,
  origin_lat numeric,
  origin_lng numeric,
  destination_address text,
  destination_lat numeric,
  destination_lng numeric,
  status text,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  eta_minutes integer,
  reservation_total_amount integer,
  reservation_date timestamptz,
  payment_mode text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id,
    t.reservation_id,
    t.client_id,
    t.driver_id,
    t.origin_address,
    t.origin_lat,
    t.origin_lng,
    t.destination_address,
    t.destination_lat,
    t.destination_lng,
    t.status::text,
    t.created_at,
    t.started_at,
    t.completed_at,
    t.archived_at,
    t.eta_minutes,
    r.total_amount,
    r.reservation_date,
    COALESCE(r.details->>'payment_mode', 'mobile_money')
  FROM public.trips t
  JOIN public.reservations r ON r.id = t.reservation_id
  WHERE public.has_role(auth.uid(), 'chauffeur'::app_role)
    AND t.driver_id = auth.uid()
    AND r.service_type = 'VTC'::service_type
    AND t.status IN ('assigned','active')
    AND t.archived_at IS NULL
  ORDER BY t.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_chauffeur_vtc_completed_trips(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  reservation_id uuid,
  client_id uuid,
  driver_id uuid,
  origin_address text,
  origin_lat numeric,
  origin_lng numeric,
  destination_address text,
  destination_lat numeric,
  destination_lng numeric,
  status text,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  eta_minutes integer,
  reservation_total_amount integer,
  reservation_date timestamptz,
  payment_mode text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id,
    t.reservation_id,
    t.client_id,
    t.driver_id,
    t.origin_address,
    t.origin_lat,
    t.origin_lng,
    t.destination_address,
    t.destination_lat,
    t.destination_lng,
    t.status::text,
    t.created_at,
    t.started_at,
    t.completed_at,
    t.archived_at,
    t.eta_minutes,
    r.total_amount,
    r.reservation_date,
    COALESCE(r.details->>'payment_mode', 'mobile_money')
  FROM public.trips t
  JOIN public.reservations r ON r.id = t.reservation_id
  WHERE public.has_role(auth.uid(), 'chauffeur'::app_role)
    AND t.driver_id = auth.uid()
    AND r.service_type = 'VTC'::service_type
    AND t.status = 'completed'
  ORDER BY t.completed_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_chauffeur_vtc_active_trips() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chauffeur_vtc_completed_trips(integer) TO authenticated;
