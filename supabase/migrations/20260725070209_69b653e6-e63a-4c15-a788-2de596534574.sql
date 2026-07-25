CREATE OR REPLACE FUNCTION public.apply_pvit_completion(_transaction_id text, _callback jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tx public.pvit_transactions;
  _new_balance integer;
BEGIN
  SELECT * INTO _tx FROM public.pvit_transactions
  WHERE transaction_id = _transaction_id FOR UPDATE;

  IF _tx.id IS NULL THEN RETURN; END IF;
  IF _tx.status = 'SUCCESS' THEN RETURN; END IF;

  UPDATE public.pvit_transactions
    SET status = 'SUCCESS',
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
      'PVT-' || substring(_transaction_id, 1, 12),
      'pvit', _tx.id, 'Recharge MyPVit ' || _tx.operator
    );

  ELSIF _tx.purpose = 'partner_booking' THEN
    UPDATE public.partner_bookings
      SET status = 'confirmed',
          payment_status = 'paid',
          paid_at = now()
      WHERE id = _tx.related_id;

  ELSIF _tx.purpose = 'flight_booking' THEN
    INSERT INTO public.flight_booking_payments(booking_id, provider, provider_reference, amount, status, payload, paid_at)
      VALUES (_tx.related_id::uuid, 'mypvit', _transaction_id, _tx.amount, 'SUCCESS', _callback, now())
      ON CONFLICT DO NOTHING;
    UPDATE public.flight_bookings
      SET status = 'paid'::flight_booking_status,
          updated_at = now()
      WHERE id = _tx.related_id::uuid
        AND status = 'pending_payment'::flight_booking_status;
  END IF;
END;
$function$;