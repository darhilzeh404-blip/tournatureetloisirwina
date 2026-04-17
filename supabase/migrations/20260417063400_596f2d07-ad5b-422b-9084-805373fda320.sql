-- =========================================================
-- Phase 1: Gérant strictly read-only, scoped to assigned circuits
-- =========================================================

-- Helper: does this gerant have a given circuit assigned?
CREATE OR REPLACE FUNCTION public.gerant_has_circuit(_user_id uuid, _circuit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_circuits uc
    WHERE uc.user_id = _user_id
      AND uc.circuit_id = _circuit_id
  )
$$;

-- Helper: does this gerant have a circuit whose name matches a given text?
CREATE OR REPLACE FUNCTION public.gerant_has_circuit_named(_user_id uuid, _name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_circuits uc
    JOIN public.circuits c ON c.id = uc.circuit_id
    WHERE uc.user_id = _user_id
      AND _name IS NOT NULL
      AND (c.nom ILIKE _name OR _name ILIKE '%' || c.nom || '%')
  )
$$;

-- ---------------------------------------------------------
-- RESERVATIONS: replace broad gerant policy with scoped one
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Gerants can view circuit reservations" ON public.reservations;

CREATE POLICY "Gerants can view their assigned circuit reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gerant'::app_role)
  AND service_type = 'CIRCUIT_TOURISTIQUE'::service_type
  AND (
    -- circuit_id stored in details JSON
    (details ? 'circuit_id'
      AND public.gerant_has_circuit(auth.uid(), (details->>'circuit_id')::uuid))
    OR
    -- legacy: circuit name stored in details
    (details ? 'circuit'
      AND public.gerant_has_circuit_named(auth.uid(), details->>'circuit'))
  )
);

-- ---------------------------------------------------------
-- RIDES: gerant can only view rides linked to assigned circuits
-- (matched by destination text against circuit names)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Gerants can view all rides" ON public.rides;

CREATE POLICY "Gerants can view rides for their circuits"
ON public.rides
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gerant'::app_role)
  AND public.gerant_has_circuit_named(auth.uid(), destination)
);

-- ---------------------------------------------------------
-- PROFILES: gerant can read profiles of clients who booked
-- one of their assigned circuits (so the dashboard shows
-- client name / phone / email for those reservations)
-- ---------------------------------------------------------
CREATE POLICY "Gerants can view client profiles for their circuit reservations"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gerant'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.user_id = profiles.user_id
      AND r.service_type = 'CIRCUIT_TOURISTIQUE'::service_type
      AND (
        (r.details ? 'circuit_id'
          AND public.gerant_has_circuit(auth.uid(), (r.details->>'circuit_id')::uuid))
        OR
        (r.details ? 'circuit'
          AND public.gerant_has_circuit_named(auth.uid(), r.details->>'circuit'))
      )
  )
);

-- NOTE: No INSERT/UPDATE/DELETE policy is added for the 'gerant' role
-- on any table. RLS denies by default → gerant is strictly read-only.