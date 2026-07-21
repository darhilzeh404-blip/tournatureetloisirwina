
CREATE OR REPLACE FUNCTION public.apply_pawapay_completion(_deposit_id uuid, _callback jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx public.pawapay_transactions;
  _new_balance integer;
BEGIN
  SELECT * INTO _tx FROM public.pawapay_transactions
  WHERE deposit_id = _deposit_id FOR UPDATE;

  IF _tx.id IS NULL THEN RETURN; END IF;
  IF _tx.status = 'COMPLETED' THEN RETURN; END IF;

  UPDATE public.pawapay_transactions
    SET status = 'COMPLETED',
        callback_payload = _callback,
        completed_at = now(),
        updated_at = now()
    WHERE id = _tx.id;

  IF _tx.purpose = 'reservation' THEN
    UPDATE public.reservations
      SET paid_amount = GREATEST(COALESCE(paid_amount,0), _tx.amount),
          paiement_valide = true,
          status = 'CONFIRMED'::reservation_status,
          updated_at = now()
      WHERE id = _tx.related_id;

  ELSIF _tx.purpose = 'wallet_recharge' THEN
    INSERT INTO public.vtc_wallets(user_id) VALUES (_tx.user_id) ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.vtc_wallets
      SET balance_points = balance_points + _tx.amount,
          total_recharged = total_recharged + _tx.amount,
          updated_at = now()
      WHERE user_id = _tx.user_id
      RETURNING balance_points INTO _new_balance;
    INSERT INTO public.vtc_wallet_transactions(
      user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
    ) VALUES (
      _tx.user_id, 'recharge', _tx.amount, _new_balance,
      'PWP-' || substring(_deposit_id::text, 1, 12),
      'pawapay', _tx.id, 'Recharge PawaPay ' || _tx.provider
    );

  ELSIF _tx.purpose = 'partner_booking' THEN
    UPDATE public.partner_bookings
      SET status = 'confirmed',
          confirmed_at = COALESCE(confirmed_at, now()),
          updated_at = now()
      WHERE id = _tx.related_id;
  END IF;
END;
$$;
