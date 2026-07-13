
-- Tighten INSERT policy on group_rides: chauffeur must self-attribute and stay within allowed ranges
DROP POLICY IF EXISTS "Chauffeurs create group_rides" ON public.group_rides;
CREATE POLICY "Chauffeurs create group_rides"
ON public.group_rides
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'chauffeur'::app_role)
  AND (driver_id IS NULL OR driver_id = auth.uid())
  AND seats_taken = 0
  AND max_seats BETWEEN 1 AND 3
  AND communes_count BETWEEN 1 AND 3
  AND price_per_seat IN (1500, 2000, 2500)
  AND status = 'searching'
  AND archived_at IS NULL
  AND started_at IS NULL
  AND completed_at IS NULL
);

-- Tighten UPDATE policy: add WITH CHECK to prevent hijacking rides
DROP POLICY IF EXISTS "Drivers accept available rides" ON public.group_rides;
CREATE POLICY "Drivers accept available rides"
ON public.group_rides
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'chauffeur'::app_role)
  AND (driver_id IS NULL OR driver_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'chauffeur'::app_role)
  AND driver_id = auth.uid()
);

-- Trigger enforces column-level immutability for non-admin drivers:
-- pricing, capacity, route, signature, seats_taken cannot be changed after row exists.
CREATE OR REPLACE FUNCTION public.enforce_group_rides_driver_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin and SECURITY DEFINER RPC callers (auth.uid() IS NULL in server contexts) unaffected
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.price_per_seat IS DISTINCT FROM OLD.price_per_seat
     OR NEW.max_seats IS DISTINCT FROM OLD.max_seats
     OR NEW.communes_count IS DISTINCT FROM OLD.communes_count
     OR NEW.route_id IS DISTINCT FROM OLD.route_id
     OR NEW.signature IS DISTINCT FROM OLD.signature
     OR NEW.seats_taken IS DISTINCT FROM OLD.seats_taken
     OR NEW.departure_deadline IS DISTINCT FROM OLD.departure_deadline
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FORBIDDEN_FIELD_UPDATE';
  END IF;

  -- Once a driver is assigned, they cannot be reassigned by another driver
  IF OLD.driver_id IS NOT NULL AND NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    RAISE EXCEPTION 'DRIVER_ALREADY_ASSIGNED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_rides_driver_update ON public.group_rides;
CREATE TRIGGER trg_enforce_group_rides_driver_update
BEFORE UPDATE ON public.group_rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_group_rides_driver_update();
