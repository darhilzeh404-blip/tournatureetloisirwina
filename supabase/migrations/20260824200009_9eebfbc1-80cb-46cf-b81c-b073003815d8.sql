CREATE OR REPLACE FUNCTION public.cancel_vtc_reservation(_reservation_id uuid)
RETURNS TABLE(refunded integer, fee integer, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _res public.reservations;
  _trip public.trips;
  _paid integer;
  _fee integer := 0;
  _refund integer := 0;
  _bal integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO _res FROM public.reservations WHERE id = _reservation_id FOR UPDATE;
  IF _res.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _res.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _res.service_type <> 'VTC'::service_type THEN RAISE EXCEPTION 'NOT_VTC'; END IF;
  IF _res.status = 'CANCELLED'::reservation_status THEN RAISE EXCEPTION 'ALREADY_CANCELLED'; END IF;

  SELECT * INTO _trip FROM public.trips WHERE reservation_id = _reservation_id FOR UPDATE;
  IF _trip.id IS NOT NULL AND (_trip.driver_id IS NOT NULL OR _trip.status IN ('active','completed')) THEN
    RAISE EXCEPTION 'DRIVER_ALREADY_ASSIGNED';
  END IF;

  _paid := GREATEST(COALESCE(_res.paid_amount, 0), 0);
  IF _paid > 0 THEN
    _fee := CEIL(_paid * 0.20)::integer;
    _refund := GREATEST(_paid - _fee, 0);

    INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.vtc_wallets
      SET balance_points = balance_points + _refund,
          total_spent = GREATEST(total_spent - _refund, 0),
          updated_at = now()
      WHERE user_id = _uid
      RETURNING balance_points INTO _bal;

    IF _refund > 0 THEN
      INSERT INTO public.vtc_wallet_transactions(
        user_id, type, amount_points, balance_after, related_type, related_id, note
      ) VALUES (_uid, 'refund', _refund, _bal, 'reservation', _reservation_id,
                'Annulation course VTC (frais 20% : ' || _fee || ' pts retenus)');
    END IF;
  ELSE
    SELECT COALESCE(balance_points, 0) INTO _bal FROM public.vtc_wallets WHERE user_id = _uid;
  END IF;

  IF _trip.id IS NOT NULL THEN
    UPDATE public.trips SET status = 'cancelled', updated_at = now() WHERE id = _trip.id;
  END IF;

  UPDATE public.reservations
    SET status = 'CANCELLED'::reservation_status,
        paid_amount = 0,
        paiement_valide = false,
        updated_at = now()
    WHERE id = _reservation_id;

  PERFORM public.notify_user(
    _uid, 'vtc',
    'Course VTC annulée',
    CASE WHEN _paid > 0
      THEN 'Remboursement de ' || _refund || ' pts sur votre portefeuille (frais d''annulation : ' || _fee || ' pts).'
      ELSE 'Votre demande de course a bien été annulée.' END,
    '/mes-reservations',
    jsonb_build_object('reservation_id', _reservation_id, 'refunded', _refund, 'fee', _fee)
  );

  PERFORM public.notify_admins(
    'vtc', 'Annulation VTC client',
    'Une course VTC a été annulée avant dispatch (frais retenus : ' || _fee || ' pts).',
    '/admin/reservations',
    jsonb_build_object('reservation_id', _reservation_id)
  );

  RETURN QUERY SELECT _refund, _fee, COALESCE(_bal, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_vtc_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_vtc_reservation(uuid) TO authenticated;