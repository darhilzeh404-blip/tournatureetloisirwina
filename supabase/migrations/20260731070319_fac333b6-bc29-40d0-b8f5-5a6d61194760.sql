-- 1. Retrait complet de MyPVit
DROP FUNCTION IF EXISTS public.apply_pvit_completion(text, jsonb);
DROP FUNCTION IF EXISTS public.apply_pvit_failure(text, text, text, jsonb);
DROP TABLE IF EXISTS public.pvit_transactions CASCADE;

-- 2. Paiement d'un billet partenaire (bus / train / bateau) avec le portefeuille
CREATE OR REPLACE FUNCTION public.pay_partner_booking_with_wallet(_booking_id uuid)
RETURNS TABLE(new_balance integer, total_paid integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bk public.partner_bookings;
  _amount integer;
  _bal integer;
  _new integer;
  _ref text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO _bk FROM public.partner_bookings WHERE id = _booking_id FOR UPDATE;
  IF _bk.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _bk.user_id IS NULL OR _bk.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _bk.status IN ('confirmed', 'completed') THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF _bk.status = 'cancelled' THEN RAISE EXCEPTION 'CANCELLED'; END IF;

  _amount := GREATEST(COALESCE(_bk.total_amount, 0), 0);
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  _new := _bal - _amount;
  _ref := 'TKT-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  UPDATE public.vtc_wallets
    SET balance_points = _new, total_spent = total_spent + _amount, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_amount, _new, _ref, 'partner_booking', _booking_id,
            'Paiement billet ' || COALESCE(_bk.reference_code, ''));

  UPDATE public.partner_bookings
    SET status = 'confirmed', confirmed_at = now(), updated_at = now()
    WHERE id = _booking_id;

  RETURN QUERY SELECT _new, _amount;
END;
$function$;

REVOKE ALL ON FUNCTION public.pay_partner_booking_with_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_partner_booking_with_wallet(uuid) TO authenticated;

-- 3. Paiement d'une réservation de vol avec le portefeuille
CREATE OR REPLACE FUNCTION public.pay_flight_booking_with_wallet(_booking_id uuid)
RETURNS TABLE(new_balance integer, total_paid integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bk public.flight_bookings;
  _amount integer;
  _bal integer;
  _new integer;
  _ref text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO _bk FROM public.flight_bookings WHERE id = _booking_id FOR UPDATE;
  IF _bk.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _bk.user_id IS NULL OR _bk.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _bk.status <> 'pending_payment'::flight_booking_status THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;

  _amount := GREATEST(COALESCE(_bk.total_amount, 0), 0);
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  _new := _bal - _amount;
  _ref := 'FLY-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  UPDATE public.vtc_wallets
    SET balance_points = _new, total_spent = total_spent + _amount, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_amount, _new, _ref, 'flight_booking', _booking_id,
            'Paiement vol ' || COALESCE(_bk.reference_code, ''));

  UPDATE public.flight_bookings
    SET status = 'paid'::flight_booking_status, updated_at = now()
    WHERE id = _booking_id;

  RETURN QUERY SELECT _new, _amount;
END;
$function$;

REVOKE ALL ON FUNCTION public.pay_flight_booking_with_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_flight_booking_with_wallet(uuid) TO authenticated;

-- 4. Durcissement : le paiement par portefeuille reste réservé aux comptes connectés
REVOKE ALL ON FUNCTION public.pay_reservation_with_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_reservation_with_wallet(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.spend_vtc_points(integer, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_vtc_points(integer, text, uuid, text) TO authenticated;