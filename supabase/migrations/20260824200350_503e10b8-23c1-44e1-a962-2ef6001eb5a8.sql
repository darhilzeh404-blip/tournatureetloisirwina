CREATE OR REPLACE FUNCTION public.cancel_vtc_reservation(_reservation_id uuid)
RETURNS TABLE(refunded integer, fee integer, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res record;
  v_trip record;
  v_paid integer := 0;
  v_fee integer := 0;
  v_refund integer := 0;
  v_balance integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_res FROM public.reservations
   WHERE id = _reservation_id AND user_id = v_uid
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_res.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'ALREADY_CANCELLED';
  END IF;

  SELECT * INTO v_trip FROM public.trips
   WHERE reservation_id = _reservation_id
   ORDER BY created_at DESC LIMIT 1
   FOR UPDATE;

  IF v_trip.id IS NOT NULL AND (v_trip.chauffeur_id IS NOT NULL OR v_trip.status IN ('active','completed')) THEN
    RAISE EXCEPTION 'DRIVER_ALREADY_ASSIGNED';
  END IF;

  v_paid := COALESCE(v_res.paid_amount, 0)::integer;
  IF v_paid > 0 THEN
    v_fee := CEIL(v_paid * 0.2)::integer;
    v_refund := GREATEST(v_paid - v_fee, 0);

    INSERT INTO public.vtc_wallets (user_id, balance_points, total_recharged, total_spent)
    VALUES (v_uid, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.vtc_wallets
       SET balance_points = balance_points + v_refund
     WHERE user_id = v_uid
     RETURNING balance_points INTO v_balance;

    INSERT INTO public.vtc_wallet_transactions
      (user_id, type, amount_points, balance_after, related_type, related_id, note)
    VALUES
      (v_uid, 'refund', v_refund, v_balance, 'reservation', _reservation_id,
       'Annulation course VTC - frais retenus: ' || v_fee || ' pts');
  ELSE
    SELECT COALESCE(balance_points, 0) INTO v_balance FROM public.vtc_wallets WHERE user_id = v_uid;
  END IF;

  UPDATE public.reservations
     SET status = 'CANCELLED', paiement_valide = false
   WHERE id = _reservation_id;

  IF v_trip.id IS NOT NULL THEN
    UPDATE public.trips SET status = 'cancelled' WHERE id = v_trip.id;
  END IF;

  PERFORM public.notify_user(
    v_uid,
    'Course VTC annulée',
    CASE WHEN v_paid > 0
      THEN 'Remboursement de ' || v_refund || ' FCFA sur votre portefeuille (frais d''annulation : ' || v_fee || ' FCFA).'
      ELSE 'Votre demande de course a été annulée.'
    END,
    'vtc'
  );

  RETURN QUERY SELECT v_refund, v_fee, COALESCE(v_balance, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_vtc_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_vtc_reservation(uuid) TO authenticated;