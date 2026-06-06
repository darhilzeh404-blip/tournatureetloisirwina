
-- 1) group_ride_passengers: force inserts through join_group_ride RPC (SECURITY DEFINER bypasses RLS)
DROP POLICY IF EXISTS "Users insert own passenger row" ON public.group_ride_passengers;

-- 2) group_ride_passengers: lock down updates - keep policy but add WITH CHECK + trigger preventing immutable field changes
DROP POLICY IF EXISTS "Users update own passenger row" ON public.group_ride_passengers;
CREATE POLICY "Users update own passenger row"
  ON public.group_ride_passengers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_passenger_field_tampering()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Admins bypass via SECURITY DEFINER RPCs; this trigger guards direct table updates.
  IF NEW.ride_id IS DISTINCT FROM OLD.ride_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.seat_index IS DISTINCT FROM OLD.seat_index
     OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
     OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
     OR NEW.destination_address IS DISTINCT FROM OLD.destination_address
     OR NEW.destination_lat IS DISTINCT FROM OLD.destination_lat
     OR NEW.destination_lng IS DISTINCT FROM OLD.destination_lng
     OR NEW.commune_pickup IS DISTINCT FROM OLD.commune_pickup
     OR NEW.commune_destination IS DISTINCT FROM OLD.commune_destination THEN
    RAISE EXCEPTION 'IMMUTABLE_PASSENGER_FIELDS';
  END IF;
  -- Allow only cancellation as a self-status transition
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_passenger_field_tampering ON public.group_ride_passengers;
CREATE TRIGGER trg_prevent_passenger_field_tampering
  BEFORE UPDATE ON public.group_ride_passengers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_passenger_field_tampering();

-- 3) partner_agencies: hide phone/email from anon visitors via column-level revoke
REVOKE SELECT (phone, email) ON public.partner_agencies FROM anon;
