ALTER TABLE public.driver_withdrawals ADD COLUMN IF NOT EXISTS fee_amount integer NOT NULL DEFAULT 0;
ALTER TABLE public.driver_withdrawals ADD COLUMN IF NOT EXISTS net_amount integer;
UPDATE public.driver_withdrawals SET net_amount = amount WHERE net_amount IS NULL;

CREATE OR REPLACE FUNCTION public.request_driver_withdrawal(_amount integer, _deposit_number text, _method text DEFAULT 'mobile_money'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _balance integer := 0;
  _pending integer := 0;
  _avail integer;
  _fee integer;
  _id uuid;
  _num text := regexp_replace(COALESCE(_deposit_number,''), '[^0-9+]', '', 'g');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'chauffeur'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF length(_num) < 8 THEN RAISE EXCEPTION 'INVALID_DEPOSIT_NUMBER'; END IF;
  IF _method NOT IN ('mobile_money','airtel_money','moov_money','cash_agent','bank_transfer') THEN
    RAISE EXCEPTION 'INVALID_METHOD';
  END IF;
  SELECT balance_earnings INTO _balance FROM public.driver_wallets WHERE driver_id = _uid FOR UPDATE;
  IF _balance IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  SELECT COALESCE(SUM(amount),0) INTO _pending FROM public.driver_withdrawals
    WHERE driver_id = _uid AND status = 'pending';
  IF _pending > 0 THEN RAISE EXCEPTION 'WITHDRAWAL_ALREADY_PENDING'; END IF;
  -- Le retrait porte toujours sur la totalité du solde.
  _avail := _balance;
  IF _avail < 1000 THEN RAISE EXCEPTION 'MIN_AMOUNT'; END IF;
  _fee := CEIL(_avail * 2 / 100.0)::integer;

  INSERT INTO public.driver_withdrawals(driver_id, amount, fee_amount, net_amount, deposit_number, method)
  VALUES (_uid, _avail, _fee, _avail - _fee, _num, _method)
  RETURNING id INTO _id;

  PERFORM public.notify_admins('Nouvelle demande de retrait',
    'Un chauffeur demande un retrait : ' || (_avail - _fee)::text || ' FCFA à déposer sur ' || _num || '.',
    'withdrawal', _id::text);
  RETURN _id;
END; $function$;

CREATE OR REPLACE FUNCTION public.credit_driver_earnings(_driver_id uuid, _trip_id uuid, _reservation_id uuid, _gross_amount integer, _payment_method text DEFAULT 'wallet'::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _fee integer; _net integer; _new integer; _inserted uuid;
BEGIN
  IF _gross_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  _fee := (_gross_amount * 10) / 100;
  _net := _gross_amount - _fee;
  INSERT INTO public.driver_wallets(driver_id) VALUES (_driver_id) ON CONFLICT (driver_id) DO NOTHING;
  INSERT INTO public.driver_wallet_transactions(
    driver_id, trip_id, reservation_id, gross_amount, platform_fee, net_amount, payment_method, kind, reference
  ) VALUES (
    _driver_id, _trip_id, _reservation_id, _gross_amount, _fee, _net,
    _payment_method, 'earning', 'TRIP-' || COALESCE(_trip_id::text, gen_random_uuid()::text)
  )
  ON CONFLICT (trip_id) WHERE trip_id IS NOT NULL AND kind = 'earning' DO NOTHING
  RETURNING id INTO _inserted;
  IF _inserted IS NULL THEN
    SELECT balance_earnings INTO _new FROM public.driver_wallets WHERE driver_id = _driver_id;
    RETURN COALESCE(_new, 0);
  END IF;
  UPDATE public.driver_wallets
    SET balance_earnings = balance_earnings + _net,
        total_earned = total_earned + _net,
        total_commission_paid = total_commission_paid + _fee,
        updated_at = now()
    WHERE driver_id = _driver_id
    RETURNING balance_earnings INTO _new;
  RETURN COALESCE(_new, 0);
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_vtc_trip(_trip_id uuid)
 RETURNS TABLE(driver_net integer, driver_balance integer, paid_via_wallet boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    UPDATE public.trips SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
      WHERE id = _trip_id;
  END IF;
  IF _trip.reservation_id IS NOT NULL THEN
    SELECT * INTO _res FROM public.reservations WHERE id = _trip.reservation_id;
    IF _res.id IS NOT NULL AND _res.service_type = 'VTC'::service_type THEN
      _payment_mode := COALESCE(_res.details->>'payment_mode', 'mobile_money');
      _gross := COALESCE(_res.service_amount, _res.total_amount, 0);
      IF _payment_mode <> 'cash' AND _gross > 0 AND _trip.driver_id IS NOT NULL THEN
        -- Chauffeur 90 %, application 10 %
        _bal := public.credit_driver_earnings(_trip.driver_id, _trip.id, _res.id, _gross, 'wallet');
        _net := _gross - (_gross * 10) / 100;
        _wallet := true;
      END IF;
    END IF;
  END IF;
  UPDATE public.trips SET archived_at = COALESCE(archived_at, now()), updated_at = now() WHERE id = _trip_id;
  IF _trip.reservation_id IS NOT NULL THEN
    UPDATE public.reservations SET archived_at = COALESCE(archived_at, now()), updated_at = now()
      WHERE id = _trip.reservation_id;
  END IF;
  UPDATE public.driver_positions SET archived_at = COALESCE(archived_at, now()), updated_at = now() WHERE trip_id = _trip_id;
  UPDATE public.client_positions SET archived_at = COALESCE(archived_at, now()), updated_at = now() WHERE trip_id = _trip_id;
  RETURN QUERY SELECT _net, _bal, _wallet;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_decide_withdrawal(_withdrawal_id uuid, _approve boolean, _note text DEFAULT NULL::text)
 RETURNS TABLE(status text, new_balance integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _wd public.driver_withdrawals;
  _balance integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.driver_withdrawals
     SET status = CASE WHEN _approve THEN 'paid' ELSE 'rejected' END,
         admin_note = _note, processed_by = _uid, processed_at = now(), updated_at = now()
   WHERE id = _withdrawal_id AND status = 'pending'
  RETURNING * INTO _wd;
  IF _wd.id IS NULL THEN RAISE EXCEPTION 'ALREADY_PROCESSED'; END IF;
  IF NOT _approve THEN
    SELECT balance_earnings INTO _balance FROM public.driver_wallets WHERE driver_id = _wd.driver_id;
    PERFORM public.notify_user(_wd.driver_id, 'Retrait refusé',
      COALESCE(_note, 'Votre demande de retrait a été refusée.'), 'withdrawal', _wd.id::text);
    RETURN QUERY SELECT 'rejected'::text, COALESCE(_balance,0);
    RETURN;
  END IF;
  SELECT balance_earnings INTO _balance FROM public.driver_wallets WHERE driver_id = _wd.driver_id FOR UPDATE;
  IF COALESCE(_balance,0) < _wd.amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  UPDATE public.driver_wallets SET balance_earnings = balance_earnings - _wd.amount, updated_at = now()
   WHERE driver_id = _wd.driver_id RETURNING balance_earnings INTO _balance;
  INSERT INTO public.driver_wallet_transactions(
    driver_id, gross_amount, platform_fee, net_amount, payment_method, kind, reference, status, note
  ) VALUES (
    _wd.driver_id, _wd.amount, _wd.fee_amount, -_wd.amount, _wd.method, 'withdrawal', _wd.reference, 'completed',
    'Retrait vers ' || _wd.deposit_number || ' (reçu ' || COALESCE(_wd.net_amount, _wd.amount)::text || ' FCFA, frais 2 %)'
  );
  PERFORM public.notify_user(_wd.driver_id, 'Retrait validé',
    'Votre retrait a été versé : ' || COALESCE(_wd.net_amount, _wd.amount)::text || ' FCFA.', 'withdrawal', _wd.id::text);
  RETURN QUERY SELECT 'paid'::text, COALESCE(_balance,0);
END; $function$;