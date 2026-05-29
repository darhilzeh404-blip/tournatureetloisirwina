
ALTER TABLE public.group_ride_payments
  ADD COLUMN IF NOT EXISTS coins_awarded boolean NOT NULL DEFAULT false;

-- Attribuer les coins à un passager après validation du paiement de covoiturage
CREATE OR REPLACE FUNCTION public.award_wina_coins_group_payment(_payment_id uuid)
RETURNS TABLE(coins_earned integer, new_balance integer, vip_level_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pay public.group_ride_payments;
  _bonus integer := 0;
  _base integer;
  _coins integer;
  _level public.vip_levels;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO _pay FROM public.group_ride_payments WHERE id = _payment_id;
  IF _pay.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
  IF _pay.coins_awarded THEN
    RETURN QUERY SELECT 0,
      COALESCE((SELECT b.coins_balance FROM public.wina_coin_balances b WHERE b.user_id = _pay.user_id), 0),
      (SELECT b.vip_level_id FROM public.wina_coin_balances b WHERE b.user_id = _pay.user_id);
    RETURN;
  END IF;

  INSERT INTO public.wina_coin_balances(user_id) VALUES (_pay.user_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT v.* INTO _level
    FROM public.wina_coin_balances b
    LEFT JOIN public.vip_levels v ON v.id = b.vip_level_id
    WHERE b.user_id = _pay.user_id;
  IF _level.id IS NULL THEN
    SELECT * INTO _level FROM public.vip_levels ORDER BY min_coins ASC LIMIT 1;
  END IF;
  _bonus := COALESCE(_level.bonus_percentage, 0);

  _base := (COALESCE(_pay.amount, 0) / 1000) * 10;
  _coins := _base + (_base * _bonus / 100);

  IF _coins > 0 THEN
    INSERT INTO public.wina_coins_history(user_id, reservation_id, reservation_type, amount_paid, coins_earned, bonus_percentage, operation_type, note)
    VALUES (_pay.user_id, _payment_id, 'COVOITURAGE', _pay.amount, _coins, _bonus, 'earn', 'Paiement covoiturage validé');
  END IF;

  UPDATE public.wina_coin_balances
    SET coins_balance = coins_balance + _coins,
        total_coins_earned = total_coins_earned + _coins,
        total_reservations = total_reservations + 1,
        updated_at = now()
    WHERE user_id = _pay.user_id;

  UPDATE public.group_ride_payments SET coins_awarded = true, updated_at = now() WHERE id = _payment_id;

  PERFORM public.recompute_vip_level(_pay.user_id);

  RETURN QUERY
    SELECT _coins,
      (SELECT b.coins_balance FROM public.wina_coin_balances b WHERE b.user_id = _pay.user_id),
      (SELECT b.vip_level_id FROM public.wina_coin_balances b WHERE b.user_id = _pay.user_id);
END;
$$;

-- Annuler les coins attribués si l'admin rejette / annule un paiement covoiturage
CREATE OR REPLACE FUNCTION public.refund_wina_coins_group_payment(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pay public.group_ride_payments;
  _earned integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO _pay FROM public.group_ride_payments WHERE id = _payment_id;
  IF _pay.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;

  SELECT COALESCE(SUM(coins_earned), 0) INTO _earned
    FROM public.wina_coins_history
    WHERE reservation_id = _payment_id
      AND reservation_type = 'COVOITURAGE'
      AND operation_type = 'earn'
      AND status = 'completed';

  IF _earned > 0 THEN
    UPDATE public.wina_coins_history SET status = 'cancelled'
      WHERE reservation_id = _payment_id AND reservation_type = 'COVOITURAGE' AND operation_type = 'earn';
    INSERT INTO public.wina_coins_history(user_id, reservation_id, reservation_type, amount_paid, coins_earned, operation_type, note)
      VALUES (_pay.user_id, _payment_id, 'COVOITURAGE', 0, -_earned, 'refund', 'Paiement covoiturage rejeté');
    UPDATE public.wina_coin_balances
      SET coins_balance = GREATEST(coins_balance - _earned, 0),
          total_coins_earned = GREATEST(total_coins_earned - _earned, 0),
          updated_at = now()
      WHERE user_id = _pay.user_id;
  END IF;

  UPDATE public.group_ride_payments SET coins_awarded = false, updated_at = now() WHERE id = _payment_id;
  PERFORM public.recompute_vip_level(_pay.user_id);
END;
$$;
