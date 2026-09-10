-- MyPVit writes are restricted to Edge Functions using the service role.
CREATE TABLE public.mypvit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  reference text NOT NULL UNIQUE DEFAULT ('WINA' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  purpose text NOT NULL CHECK (purpose IN ('reservation', 'wallet_recharge')),
  reservation_id uuid REFERENCES public.reservations(id),
  payment_id uuid REFERENCES public.payments(id),
  amount integer NOT NULL CHECK (amount > 0),
  channel text NOT NULL CHECK (channel IN ('airtel_money', 'moov_money')),
  phone text NOT NULL,
  operator_code text NOT NULL,
  account_code text NOT NULL,
  provider_id text UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  submitted_at timestamptz,
  checked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id),
  CHECK ((purpose = 'reservation') = (reservation_id IS NOT NULL))
);
CREATE UNIQUE INDEX mypvit_one_pending_reservation ON public.mypvit_transactions(reservation_id)
  WHERE status = 'PENDING' AND purpose = 'reservation';
CREATE UNIQUE INDEX mypvit_one_pending_recharge ON public.mypvit_transactions(user_id)
  WHERE status = 'PENDING' AND purpose = 'wallet_recharge';
ALTER TABLE public.mypvit_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mypvit_transactions FROM anon, authenticated;
GRANT ALL ON public.mypvit_transactions TO service_role;

CREATE TABLE public.mypvit_secrets (
  account_code text PRIMARY KEY,
  secret text,
  expires_at timestamptz,
  lease_until timestamptz
);
ALTER TABLE public.mypvit_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mypvit_secrets FROM anon, authenticated;
GRANT ALL ON public.mypvit_secrets TO service_role;

CREATE FUNCTION public.mypvit_claim_secret(_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.mypvit_secrets;
BEGIN
  INSERT INTO public.mypvit_secrets(account_code) VALUES (_account) ON CONFLICT DO NOTHING;
  SELECT * INTO s FROM public.mypvit_secrets WHERE account_code = _account FOR UPDATE;
  IF s.expires_at > now() + interval '90 seconds' THEN
    RETURN jsonb_build_object('secret', s.secret);
  END IF;
  IF s.lease_until > now() THEN RETURN jsonb_build_object('wait', true); END IF;
  UPDATE public.mypvit_secrets SET lease_until = now() + interval '30 seconds' WHERE account_code = _account;
  RETURN jsonb_build_object('renew', true);
END;
$$;

CREATE FUNCTION public.mypvit_prepare(
  _user uuid, _request uuid, _purpose text, _reservation uuid,
  _amount integer, _channel text, _phone text, _operator text, _account text
) RETURNS public.mypvit_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.mypvit_transactions; r public.reservations; p uuid; due integer;
BEGIN
  -- Serialize retries, including requests from separate tabs/devices.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user::text, 0));
  SELECT * INTO t FROM public.mypvit_transactions WHERE user_id = _user AND request_id = _request;
  IF FOUND THEN
    IF t.purpose <> _purpose OR t.reservation_id IS DISTINCT FROM _reservation OR t.amount <> _amount
       OR t.channel <> _channel OR t.phone <> _phone THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
    RETURN t;
  END IF;
  SELECT * INTO t FROM public.mypvit_transactions
    WHERE user_id = _user AND purpose = _purpose AND reservation_id IS NOT DISTINCT FROM _reservation AND status = 'PENDING';
  IF FOUND THEN RETURN t; END IF;
  IF (SELECT count(*) FROM public.mypvit_transactions WHERE user_id = _user AND created_at > now() - interval '1 hour') >= 15 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  IF _purpose = 'reservation' THEN
    SELECT * INTO r FROM public.reservations WHERE id = _reservation FOR UPDATE;
    IF NOT FOUND OR r.user_id <> _user THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.service_type = 'VTC' THEN RAISE EXCEPTION 'WALLET_REQUIRED'; END IF;
    IF r.status NOT IN ('PENDING_PAYMENT', 'CONFIRMED') OR r.paiement_valide THEN RAISE EXCEPTION 'NOT_PAYABLE'; END IF;
    due := r.total_amount - r.paid_amount - COALESCE(r.coins_used, 0);
    IF due <= 0 OR _amount <> due THEN RAISE EXCEPTION 'AMOUNT_CHANGED'; END IF;
    IF EXISTS (SELECT 1 FROM public.payments WHERE reservation_id = r.id AND status = 'PENDING') THEN
      RAISE EXCEPTION 'PAYMENT_ALREADY_PENDING';
    END IF;
  ELSIF _purpose = 'wallet_recharge' THEN
    IF _reservation IS NOT NULL OR _amount < 500 OR _amount > 1000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  ELSE RAISE EXCEPTION 'INVALID_PURPOSE'; END IF;

  INSERT INTO public.mypvit_transactions(user_id, request_id, purpose, reservation_id, amount, channel, phone, operator_code, account_code)
    VALUES (_user, _request, _purpose, _reservation, _amount, _channel, _phone, _operator, _account) RETURNING * INTO t;
  IF _purpose = 'reservation' THEN
    INSERT INTO public.payments(reservation_id, user_id, amount, method, transaction_ref)
      VALUES (_reservation, _user, _amount, _channel, t.reference) RETURNING id INTO p;
    UPDATE public.mypvit_transactions SET payment_id = p WHERE id = t.id RETURNING * INTO t;
  END IF;
  RETURN t;
END;
$$;

CREATE FUNCTION public.mypvit_settle(_id uuid, _status text, _provider_id text)
RETURNS public.mypvit_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.mypvit_transactions; r public.reservations; b integer;
BEGIN
  SELECT * INTO t FROM public.mypvit_transactions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _status IS NULL OR _status NOT IN ('SUCCESS', 'FAILED') OR (_status = 'SUCCESS' AND _provider_id IS NULL) THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF t.provider_id IS NOT NULL AND t.provider_id IS DISTINCT FROM _provider_id THEN RAISE EXCEPTION 'PROVIDER_MISMATCH'; END IF;
  IF t.status <> 'PENDING' THEN
    IF t.status <> _status THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
    RETURN t;
  END IF;
  UPDATE public.mypvit_transactions SET status = _status, provider_id = _provider_id, completed_at = now()
    WHERE id = t.id RETURNING * INTO t;
  IF t.purpose = 'reservation' THEN
    SELECT * INTO r FROM public.reservations WHERE id = t.reservation_id FOR UPDATE;
    UPDATE public.payments SET status = CASE WHEN _status = 'SUCCESS' THEN 'VALIDATED'::payment_status ELSE 'REJECTED'::payment_status END
      WHERE id = t.payment_id;
    IF _status = 'SUCCESS' THEN
      UPDATE public.reservations SET paid_amount = paid_amount + t.amount,
        paiement_valide = true, status = 'CONFIRMED'::reservation_status WHERE id = r.id;
    END IF;
  ELSIF _status = 'SUCCESS' THEN
    INSERT INTO public.vtc_wallets(user_id) VALUES (t.user_id) ON CONFLICT DO NOTHING;
    UPDATE public.vtc_wallets SET balance_points = balance_points + t.amount,
      total_recharged = total_recharged + t.amount, updated_at = now()
      WHERE user_id = t.user_id RETURNING balance_points INTO b;
    INSERT INTO public.vtc_wallet_transactions(user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note)
      VALUES (t.user_id, 'recharge', t.amount, b, t.reference, 'mypvit', t.id, 'Recharge MyPVit');
    INSERT INTO public.vtc_recharge_requests(user_id, amount_points, amount_fcfa, payment_method, payment_reference, agent_code, status, validated_at, admin_note)
      VALUES (t.user_id, t.amount, t.amount, t.channel::vtc_recharge_method, t.reference, 'MyPVit', 'approved', now(), 'Confirmation automatique MyPVit');
  END IF;
  RETURN t;
END;
$$;

-- A pending provider debit cannot be cancelled or paid a second time by another channel.
CREATE FUNCTION public.mypvit_guard_reservation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.paid_amount, NEW.coins_used, NEW.total_amount, NEW.status, NEW.paiement_valide, NEW.user_id, NEW.details)
     IS DISTINCT FROM (OLD.paid_amount, OLD.coins_used, OLD.total_amount, OLD.status, OLD.paiement_valide, OLD.user_id, OLD.details)
     AND EXISTS (SELECT 1 FROM public.mypvit_transactions WHERE reservation_id = OLD.id AND status = 'PENDING') THEN
    RAISE EXCEPTION 'MYPVIT_PAYMENT_PENDING';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mypvit_guard_reservation BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.mypvit_guard_reservation();

CREATE FUNCTION public.mypvit_guard_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM 1 FROM public.reservations WHERE id = NEW.reservation_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.mypvit_transactions WHERE reservation_id = NEW.reservation_id AND status = 'PENDING' AND reference IS DISTINCT FROM NEW.transaction_ref) THEN
      RAISE EXCEPTION 'MYPVIT_PAYMENT_PENDING';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.mypvit_transactions WHERE payment_id = OLD.id)
    AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
    AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'MYPVIT_MANAGED_PAYMENT';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mypvit_guard_payment BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.mypvit_guard_payment();

REVOKE ALL ON FUNCTION public.mypvit_claim_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mypvit_prepare(uuid, uuid, text, uuid, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mypvit_settle(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mypvit_claim_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mypvit_prepare(uuid, uuid, text, uuid, integer, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mypvit_settle(uuid, text, text) TO service_role;
