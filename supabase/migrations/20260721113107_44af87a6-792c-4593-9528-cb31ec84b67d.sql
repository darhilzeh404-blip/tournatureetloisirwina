
-- 1) Prevent client-side price tampering on reservations
CREATE OR REPLACE FUNCTION public.validate_reservation_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _expected integer;
  _tid uuid;
  _pid uuid;
  _cid uuid;
  _seats int;
  _persons int;
  _unit int;
BEGIN
  -- Admins / server contexts bypass
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admin cannot alter total_amount / paid_amount / service_type / user_id on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount
       OR NEW.service_type IS DISTINCT FROM OLD.service_type
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'FORBIDDEN_FIELD_UPDATE';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.total_amount IS NULL OR NEW.total_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL_AMOUNT';
  END IF;

  -- BILLET: recompute from tickets or partner_tickets
  IF NEW.service_type = 'BILLET'::service_type THEN
    _tid := NULLIF(NEW.details->>'ticket_id','')::uuid;
    _pid := NULLIF(NEW.details->>'partner_ticket_id','')::uuid;
    _seats := GREATEST(COALESCE((NEW.details->>'seats')::int, (NEW.details->>'quantity')::int, 1), 1);
    IF _pid IS NOT NULL THEN
      SELECT price INTO _unit FROM public.partner_tickets WHERE id = _pid;
    ELSIF _tid IS NOT NULL THEN
      SELECT price INTO _unit FROM public.tickets WHERE id = _tid;
    END IF;
    IF _unit IS NOT NULL THEN
      _expected := _unit * _seats;
      IF NEW.total_amount <> _expected THEN
        RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_BILLET: expected %, got %', _expected, NEW.total_amount;
      END IF;
    END IF;

  -- CIRCUIT_TOURISTIQUE: base_price * persons
  ELSIF NEW.service_type = 'CIRCUIT_TOURISTIQUE'::service_type THEN
    _cid := NULLIF(NEW.details->>'circuit_id','')::uuid;
    _persons := GREATEST(COALESCE((NEW.details->>'persons')::int, (NEW.details->>'nb_personnes')::int, (NEW.details->>'quantity')::int, 1), 1);
    IF _cid IS NOT NULL THEN
      SELECT base_price INTO _unit FROM public.circuits WHERE id = _cid;
      IF _unit IS NOT NULL THEN
        _expected := _unit * _persons;
        -- Allow >= expected (options like guide/lodging may be added), but never below
        IF NEW.total_amount < _expected THEN
          RAISE EXCEPTION 'TOTAL_AMOUNT_BELOW_MIN_CIRCUIT: min %, got %', _expected, NEW.total_amount;
        END IF;
      END IF;
    END IF;

  -- LOCATION_CATALOGUE: catalog_vehicles.daily_rate * days * quantity
  ELSIF NEW.service_type = 'LOCATION_CATALOGUE'::service_type THEN
    DECLARE
      _vid uuid := NULLIF(NEW.details->>'vehicle_id','')::uuid;
      _days int := GREATEST(COALESCE((NEW.details->>'days')::int, 1), 1);
      _qty int := GREATEST(COALESCE((NEW.details->>'quantity')::int, 1), 1);
    BEGIN
      IF _vid IS NOT NULL THEN
        SELECT daily_rate INTO _unit FROM public.catalog_vehicles WHERE id = _vid;
        IF _unit IS NOT NULL THEN
          _expected := _unit * _days * _qty;
          IF NEW.total_amount <> _expected THEN
            RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_CATALOGUE: expected %, got %', _expected, NEW.total_amount;
          END IF;
        END IF;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reservation_amount ON public.reservations;
CREATE TRIGGER trg_validate_reservation_amount
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.validate_reservation_amount();

-- Also lock payments.amount to match the reservation's server-side total for non-admin inserts
CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _res public.reservations;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'FORBIDDEN_FIELD_UPDATE';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.amount IS NULL OR NEW.amount < 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT';
  END IF;

  IF NEW.reservation_id IS NOT NULL THEN
    SELECT * INTO _res FROM public.reservations WHERE id = NEW.reservation_id;
    IF _res.id IS NOT NULL AND _res.total_amount IS NOT NULL THEN
      IF NEW.amount <> _res.total_amount THEN
        RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH: expected %, got %', _res.total_amount, NEW.amount;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_amount ON public.payments;
CREATE TRIGGER trg_validate_payment_amount
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_amount();

-- 2) Prevent passengers tampering with seat/pickup/destination/ride_id via RLS UPDATE gap
CREATE OR REPLACE FUNCTION public.prevent_passenger_field_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admins and server contexts bypass
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Drivers assigned to the ride may update logistical fields
  IF public.is_group_ride_driver(auth.uid(), NEW.ride_id) THEN
    IF NEW.ride_id IS DISTINCT FROM OLD.ride_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.seat_index IS DISTINCT FROM OLD.seat_index THEN
      RAISE EXCEPTION 'FORBIDDEN_FIELD_UPDATE';
    END IF;
    RETURN NEW;
  END IF;

  -- Owning passenger: only status change to cancelled is allowed; all other columns immutable
  IF NEW.user_id = auth.uid() THEN
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
       OR NEW.commune_destination IS DISTINCT FROM OLD.commune_destination
       OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
      RAISE EXCEPTION 'FORBIDDEN_FIELD_UPDATE';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'FORBIDDEN';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_passenger_field_tampering ON public.group_ride_passengers;
CREATE TRIGGER trg_prevent_passenger_field_tampering
  BEFORE UPDATE ON public.group_ride_passengers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_passenger_field_tampering();

-- 3) transport_settings: switch to allow-list for public reads
DROP POLICY IF EXISTS "Public can view non-sensitive transport_settings" ON public.transport_settings;
CREATE POLICY "Public can view whitelisted transport_settings"
  ON public.transport_settings
  FOR SELECT
  USING (
    key = ANY (ARRAY[
      'round_trip_multiplier',
      'child_supplement',
      'vip_multiplier',
      'whatsapp_fallback_enabled'
    ])
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4) vtc_recharge_requests: remove the permissive ALL policy that lets a user UPDATE/DELETE their own row
DROP POLICY IF EXISTS "restrict_vtc_recharge_requests" ON public.vtc_recharge_requests;

-- Keep existing INSERT/SELECT policies. Add explicit admin-only UPDATE/DELETE.
DROP POLICY IF EXISTS "recharge_admin_update" ON public.vtc_recharge_requests;
CREATE POLICY "recharge_admin_update"
  ON public.vtc_recharge_requests
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "recharge_admin_delete" ON public.vtc_recharge_requests;
CREATE POLICY "recharge_admin_delete"
  ON public.vtc_recharge_requests
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));
