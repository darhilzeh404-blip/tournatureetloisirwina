-- 1. join_group_ride: server-side price enforcement
CREATE OR REPLACE FUNCTION public.join_group_ride(_signature text, _communes_count smallint, _price_per_seat integer, _wait_minutes integer, _max_seats smallint, _pickup_address text, _pickup_lat numeric, _pickup_lng numeric, _destination_address text, _destination_lat numeric, _destination_lng numeric, _commune_pickup text, _commune_destination text)
 RETURNS TABLE(ride_id uuid, seat_index smallint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _ride public.group_rides;
  _seat smallint;
  _bal integer;
  _new integer;
  _ref text;
  _price integer;
  _cc smallint;
  _seats smallint;
  _wait integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  -- Server-side normalisation: never trust client pricing/capacity inputs
  _cc := LEAST(3, GREATEST(1, COALESCE(_communes_count, 1)));
  _price := CASE _cc WHEN 1 THEN 1500 WHEN 2 THEN 2000 ELSE 2500 END;
  _seats := LEAST(3, GREATEST(1, COALESCE(_max_seats, 3)));
  _wait := LEAST(30, GREATEST(1, COALESCE(_wait_minutes, 5)));

  IF EXISTS (
    SELECT 1 FROM public.group_ride_passengers p
    JOIN public.group_rides r ON r.id = p.ride_id
    WHERE p.user_id = _uid AND p.status <> 'cancelled'
      AND r.status IN ('searching','matched','driver_arriving','active')
      AND r.archived_at IS NULL
  ) THEN RAISE EXCEPTION 'ALREADY_IN_RIDE'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal < _price THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;
  _new := _bal - _price;
  _ref := 'GRP-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));
  UPDATE public.vtc_wallets
    SET balance_points = _new, total_spent = total_spent + _price, updated_at = now()
    WHERE user_id = _uid;

  SELECT * INTO _ride
  FROM public.group_rides
  WHERE status = 'searching' AND signature = _signature
    AND seats_taken < max_seats AND departure_deadline > now() AND archived_at IS NULL
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF _ride.id IS NULL THEN
    INSERT INTO public.group_rides (
      status, communes_count, price_per_seat, max_seats, seats_taken, departure_deadline, signature
    ) VALUES (
      'searching', _cc, _price, _seats, 1,
      now() + (_wait || ' minutes')::interval, _signature
    ) RETURNING * INTO _ride;
    _seat := 1;
  ELSE
    _seat := _ride.seats_taken + 1;
    UPDATE public.group_rides
       SET seats_taken = _seat,
           status = CASE WHEN _seat >= max_seats THEN 'matched' ELSE status END,
           updated_at = now()
     WHERE id = _ride.id;
  END IF;

  INSERT INTO public.group_ride_passengers (
    ride_id, user_id, pickup_address, pickup_lat, pickup_lng,
    destination_address, destination_lat, destination_lng,
    commune_pickup, commune_destination, seat_index, status
  ) VALUES (
    _ride.id, _uid, _pickup_address, _pickup_lat, _pickup_lng,
    _destination_address, _destination_lat, _destination_lng,
    _commune_pickup, _commune_destination, _seat, 'matched'
  );

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_price, _new, _ref, 'group_ride', _ride.id,
            'Place covoiturage (siege ' || _seat || ')');

  ride_id := _ride.id; seat_index := _seat;
  RETURN NEXT;
END; $function$;

-- 2. find_nearby_vtc_drivers: restrict live driver GPS exposure
CREATE OR REPLACE FUNCTION public.find_nearby_vtc_drivers(_pickup_lat numeric, _pickup_lng numeric, _radius_km numeric DEFAULT 5, _category vtc_category DEFAULT NULL::vtc_category)
 RETURNS TABLE(driver_id uuid, latitude numeric, longitude numeric, distance_km numeric, last_seen_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  IF NOT (
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'chauffeur'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.client_id = _uid
        AND t.status NOT IN ('completed','cancelled')
        AND t.created_at > now() - interval '3 hours'
        AND t.origin_lat IS NOT NULL AND t.origin_lng IS NOT NULL
        AND (2 * 6371 * asin(sqrt(
              power(sin(radians((t.origin_lat - _pickup_lat) / 2)), 2)
              + cos(radians(_pickup_lat)) * cos(radians(t.origin_lat))
              * power(sin(radians((t.origin_lng - _pickup_lng) / 2)), 2)
            ))) <= 10
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.driver_id, p.latitude, p.longitude,
    (2 * 6371 * asin(sqrt(
      power(sin(radians((p.latitude  - _pickup_lat) / 2)), 2)
      + cos(radians(_pickup_lat)) * cos(radians(p.latitude))
      * power(sin(radians((p.longitude - _pickup_lng) / 2)), 2)
    )))::numeric AS distance_km,
    a.last_seen_at
  FROM public.driver_positions p
  JOIN public.driver_availability a ON a.driver_id = p.driver_id
  JOIN public.user_roles r ON r.user_id = p.driver_id AND r.role = 'chauffeur'::app_role
  JOIN public.drivers d ON d.user_id = p.driver_id
  WHERE p.archived_at IS NULL
    AND a.is_online = true
    AND (a.last_seen_at > now() - interval '10 minutes' OR p.updated_at > now() - interval '10 minutes')
    AND p.updated_at > now() - interval '30 minutes'
    AND (_category IS NULL OR d.category = _category)
    AND (2 * 6371 * asin(sqrt(
      power(sin(radians((p.latitude  - _pickup_lat) / 2)), 2)
      + cos(radians(_pickup_lat)) * cos(radians(p.latitude))
      * power(sin(radians((p.longitude - _pickup_lng) / 2)), 2)
    ))) <= _radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
END; $function$;

-- 3. group_rides: drivers cannot change pricing/capacity when accepting
CREATE OR REPLACE FUNCTION public.enforce_group_ride_driver_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'chauffeur'::app_role) THEN
    NEW.price_per_seat := OLD.price_per_seat;
    NEW.max_seats := OLD.max_seats;
    NEW.seats_taken := OLD.seats_taken;
    NEW.communes_count := OLD.communes_count;
    NEW.signature := OLD.signature;
  END IF;

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_enforce_group_ride_driver_update ON public.group_rides;
CREATE TRIGGER trg_enforce_group_ride_driver_update
BEFORE UPDATE ON public.group_rides
FOR EACH ROW EXECUTE FUNCTION public.enforce_group_ride_driver_update();

-- 4. partner_agencies: owners cannot self-verify or change commission
CREATE OR REPLACE FUNCTION public.enforce_partner_agency_owner_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.is_verified := OLD.is_verified;
  NEW.commission_percent := OLD.commission_percent;
  NEW.owner_user_id := OLD.owner_user_id;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_enforce_partner_agency_owner_update ON public.partner_agencies;
CREATE TRIGGER trg_enforce_partner_agency_owner_update
BEFORE UPDATE ON public.partner_agencies
FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_agency_owner_update();

CREATE OR REPLACE FUNCTION public.enforce_partner_agency_owner_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.is_verified := false;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_enforce_partner_agency_owner_insert ON public.partner_agencies;
CREATE TRIGGER trg_enforce_partner_agency_owner_insert
BEFORE INSERT ON public.partner_agencies
FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_agency_owner_insert();