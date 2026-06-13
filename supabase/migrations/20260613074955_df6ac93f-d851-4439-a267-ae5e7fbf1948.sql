
-- 1. Internalize credit_driver_earnings: keep admin guard but allow SECURITY DEFINER callers
-- by removing the auth check (callers are themselves SECURITY DEFINER and authorize).
CREATE OR REPLACE FUNCTION public.credit_driver_earnings(
  _driver_id uuid, _trip_id uuid, _reservation_id uuid,
  _gross_amount integer, _payment_method text DEFAULT 'wallet'::text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _fee integer; _net integer; _new integer;
BEGIN
  IF _gross_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  _fee := (_gross_amount * 20) / 100;
  _net := _gross_amount - _fee;

  INSERT INTO public.driver_wallets(driver_id) VALUES (_driver_id) ON CONFLICT (driver_id) DO NOTHING;
  UPDATE public.driver_wallets
    SET balance_earnings = balance_earnings + _net,
        total_earned = total_earned + _net,
        total_commission_paid = total_commission_paid + _fee,
        updated_at = now()
    WHERE driver_id = _driver_id
    RETURNING balance_earnings INTO _new;

  INSERT INTO public.driver_wallet_transactions(
    driver_id, trip_id, reservation_id, gross_amount, platform_fee, net_amount, payment_method
  ) VALUES (_driver_id, _trip_id, _reservation_id, _gross_amount, _fee, _net, _payment_method);
  RETURN _new;
END; $$;

-- Public-callable wrapper kept admin-only (keeps existing behaviour for any admin tool).
CREATE OR REPLACE FUNCTION public.admin_credit_driver_earnings(
  _driver_id uuid, _trip_id uuid, _reservation_id uuid,
  _gross_amount integer, _payment_method text DEFAULT 'wallet'::text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN public.credit_driver_earnings(_driver_id, _trip_id, _reservation_id, _gross_amount, _payment_method);
END; $$;

-- 2. Pay a reservation from the VTC wallet (instant debit, confirms reservation)
CREATE OR REPLACE FUNCTION public.pay_reservation_with_wallet(_reservation_id uuid)
RETURNS TABLE(new_balance integer, total_paid integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _res public.reservations;
  _amount integer;
  _bal integer;
  _new integer;
  _ref text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO _res FROM public.reservations WHERE id = _reservation_id FOR UPDATE;
  IF _res.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _res.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _res.paiement_valide THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;

  _amount := GREATEST(COALESCE(_res.total_amount, 0) - COALESCE(_res.coins_used, 0), 0);
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  _new := _bal - _amount;
  _ref := 'PAY-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  UPDATE public.vtc_wallets
    SET balance_points = _new, total_spent = total_spent + _amount, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_amount, _new, _ref, 'reservation', _reservation_id,
            'Paiement réservation ' || _res.service_type::text);

  UPDATE public.reservations
    SET paid_amount = _amount,
        paiement_valide = true,
        status = 'CONFIRMED'::reservation_status,
        updated_at = now()
    WHERE id = _reservation_id;

  RETURN QUERY SELECT _new, _amount;
END; $$;

-- 3. Replace join_group_ride to also debit wallet (atomic: insuffisant => rollback complet)
CREATE OR REPLACE FUNCTION public.join_group_ride(
  _signature text, _communes_count smallint, _price_per_seat integer,
  _wait_minutes integer, _max_seats smallint,
  _pickup_address text, _pickup_lat numeric, _pickup_lng numeric,
  _destination_address text, _destination_lat numeric, _destination_lng numeric,
  _commune_pickup text, _commune_destination text
) RETURNS TABLE(ride_id uuid, seat_index smallint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ride public.group_rides;
  _seat smallint;
  _bal integer;
  _new integer;
  _ref text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_ride_passengers p
    JOIN public.group_rides r ON r.id = p.ride_id
    WHERE p.user_id = _uid AND p.status <> 'cancelled'
      AND r.status IN ('searching','matched','driver_arriving','active')
      AND r.archived_at IS NULL
  ) THEN RAISE EXCEPTION 'ALREADY_IN_RIDE'; END IF;

  -- Wallet check + debit FIRST (atomic transaction; if anything below fails the debit rolls back)
  IF _price_per_seat <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal < _price_per_seat THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;
  _new := _bal - _price_per_seat;
  _ref := 'GRP-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));
  UPDATE public.vtc_wallets
    SET balance_points = _new, total_spent = total_spent + _price_per_seat, updated_at = now()
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
      'searching', _communes_count, _price_per_seat, _max_seats, 1,
      now() + (_wait_minutes || ' minutes')::interval, _signature
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
  ) VALUES (_uid, 'trip_payment', -_price_per_seat, _new, _ref, 'group_ride', _ride.id,
            'Place covoiturage (siège ' || _seat || ')');

  ride_id := _ride.id; seat_index := _seat;
  RETURN NEXT;
END; $$;

-- 4. Complete a VTC trip: chauffeur marks completed, system credits 80/20 if wallet-paid, archives
CREATE OR REPLACE FUNCTION public.complete_vtc_trip(_trip_id uuid)
RETURNS TABLE(driver_net integer, driver_balance integer, paid_via_wallet boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _trip public.trips;
  _res public.reservations;
  _payment_mode text;
  _gross integer := 0;
  _net integer := 0;
  _bal integer := 0;
  _wallet boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO _trip FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF _trip.id IS NULL THEN RAISE EXCEPTION 'TRIP_NOT_FOUND'; END IF;
  IF _trip.driver_id <> _uid AND NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF _trip.status NOT IN ('completed') THEN
    UPDATE public.trips
      SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
      WHERE id = _trip_id;
  END IF;

  IF _trip.reservation_id IS NOT NULL THEN
    SELECT * INTO _res FROM public.reservations WHERE id = _trip.reservation_id;
    IF _res.id IS NOT NULL AND _res.service_type = 'VTC'::service_type THEN
      _payment_mode := COALESCE(_res.details->>'payment_mode', 'mobile_money');
      _gross := COALESCE(_res.total_amount, 0);
      IF _payment_mode <> 'cash' AND _gross > 0 AND _trip.driver_id IS NOT NULL THEN
        -- Wallet-paid trip: credit driver 80%, platform 20%
        _bal := public.credit_driver_earnings(
          _trip.driver_id, _trip.id, _res.id, _gross, 'wallet'
        );
        _net := _gross - (_gross * 20) / 100;
        _wallet := true;
      END IF;
    END IF;
  END IF;

  -- archive trip + reservation + positions
  UPDATE public.trips
    SET archived_at = COALESCE(archived_at, now()), updated_at = now()
    WHERE id = _trip_id;
  IF _trip.reservation_id IS NOT NULL THEN
    UPDATE public.reservations
      SET archived_at = COALESCE(archived_at, now()), updated_at = now()
      WHERE id = _trip.reservation_id;
  END IF;
  UPDATE public.driver_positions
    SET archived_at = COALESCE(archived_at, now()), updated_at = now()
    WHERE trip_id = _trip_id;
  UPDATE public.client_positions
    SET archived_at = COALESCE(archived_at, now()), updated_at = now()
    WHERE trip_id = _trip_id;

  RETURN QUERY SELECT _net, _bal, _wallet;
END; $$;
