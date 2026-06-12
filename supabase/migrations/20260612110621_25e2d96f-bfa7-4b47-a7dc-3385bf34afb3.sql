
-- =========================================================
-- VTC POINTS WALLET (CLIENT)
-- =========================================================
CREATE TABLE public.vtc_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_points integer NOT NULL DEFAULT 0 CHECK (balance_points >= 0),
  total_recharged integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vtc_wallets TO authenticated;
GRANT ALL ON public.vtc_wallets TO service_role;
ALTER TABLE public.vtc_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vtc_wallets_self_select" ON public.vtc_wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vtc_wallets_updated_at
  BEFORE UPDATE ON public.vtc_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- VTC WALLET TRANSACTIONS
-- =========================================================
CREATE TYPE public.vtc_tx_type AS ENUM ('recharge','trip_payment','refund','admin_adjust');

CREATE TABLE public.vtc_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.vtc_tx_type NOT NULL,
  amount_points integer NOT NULL,
  balance_after integer NOT NULL,
  reference_code text,
  related_type text,
  related_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vtc_wallet_transactions TO authenticated;
GRANT ALL ON public.vtc_wallet_transactions TO service_role;
ALTER TABLE public.vtc_wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vtc_tx_self_select" ON public.vtc_wallet_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX ON public.vtc_wallet_transactions(user_id, created_at DESC);

-- =========================================================
-- RECHARGE REQUESTS
-- =========================================================
CREATE TYPE public.vtc_recharge_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.vtc_recharge_method AS ENUM ('mobile_money','cash_agent','bank_transfer','other');

CREATE TABLE public.vtc_recharge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_points integer NOT NULL CHECK (amount_points > 0),
  amount_fcfa integer NOT NULL CHECK (amount_fcfa > 0),
  payment_method public.vtc_recharge_method NOT NULL,
  payment_reference text,
  agent_code text,
  proof_url text,
  status public.vtc_recharge_status NOT NULL DEFAULT 'pending',
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  admin_note text,
  client_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vtc_recharge_requests TO authenticated;
GRANT ALL ON public.vtc_recharge_requests TO service_role;
ALTER TABLE public.vtc_recharge_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recharge_self_select" ON public.vtc_recharge_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "recharge_self_insert" ON public.vtc_recharge_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE TRIGGER update_recharge_updated_at
  BEFORE UPDATE ON public.vtc_recharge_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.vtc_recharge_requests(status, created_at DESC);

-- =========================================================
-- DRIVER WALLET
-- =========================================================
CREATE TABLE public.driver_wallets (
  driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_earnings integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_commission_paid integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_wallets TO authenticated;
GRANT ALL ON public.driver_wallets TO service_role;
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_wallet_self" ON public.driver_wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_driver_wallets_updated_at
  BEFORE UPDATE ON public.driver_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- DRIVER WALLET TRANSACTIONS
-- =========================================================
CREATE TABLE public.driver_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid,
  reservation_id uuid,
  gross_amount integer NOT NULL,
  platform_fee integer NOT NULL,
  net_amount integer NOT NULL,
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_wallet_transactions TO authenticated;
GRANT ALL ON public.driver_wallet_transactions TO service_role;
ALTER TABLE public.driver_wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_tx_self" ON public.driver_wallet_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX ON public.driver_wallet_transactions(driver_id, created_at DESC);

-- =========================================================
-- FUNCTIONS
-- =========================================================

-- Request a recharge (client)
CREATE OR REPLACE FUNCTION public.request_vtc_recharge(
  _amount_points integer,
  _payment_method public.vtc_recharge_method,
  _payment_reference text,
  _agent_code text,
  _proof_url text DEFAULT NULL,
  _client_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _amount_points <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF _payment_reference IS NULL OR length(trim(_payment_reference)) = 0 THEN
    RAISE EXCEPTION 'REFERENCE_REQUIRED';
  END IF;
  IF _agent_code IS NULL OR length(trim(_agent_code)) = 0 THEN
    RAISE EXCEPTION 'AGENT_CODE_REQUIRED';
  END IF;

  INSERT INTO public.vtc_recharge_requests(
    user_id, amount_points, amount_fcfa, payment_method,
    payment_reference, agent_code, proof_url, client_note
  ) VALUES (
    _uid, _amount_points, _amount_points, _payment_method,
    trim(_payment_reference), trim(_agent_code), _proof_url, _client_note
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- Admin validates a recharge
CREATE OR REPLACE FUNCTION public.admin_validate_vtc_recharge(
  _request_id uuid,
  _approve boolean,
  _note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _req public.vtc_recharge_requests;
  _new_balance integer;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO _req FROM public.vtc_recharge_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_PROCESSED'; END IF;

  IF NOT _approve THEN
    UPDATE public.vtc_recharge_requests
      SET status='rejected', validated_by=_uid, validated_at=now(), admin_note=_note
      WHERE id=_request_id;
    RETURN 0;
  END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_req.user_id)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.vtc_wallets
    SET balance_points = balance_points + _req.amount_points,
        total_recharged = total_recharged + _req.amount_points,
        updated_at = now()
    WHERE user_id = _req.user_id
    RETURNING balance_points INTO _new_balance;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (
    _req.user_id, 'recharge', _req.amount_points, _new_balance,
    _req.payment_reference, 'recharge_request', _req.id,
    COALESCE(_note, 'Recharge validée')
  );

  UPDATE public.vtc_recharge_requests
    SET status='approved', validated_by=_uid, validated_at=now(), admin_note=_note
    WHERE id=_request_id;

  RETURN _new_balance;
END;
$$;

-- Spend points (client) for a VTC / covoiturage course
CREATE OR REPLACE FUNCTION public.spend_vtc_points(
  _amount integer,
  _related_type text,
  _related_id uuid,
  _note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _bal integer;
  _new integer;
  _ref text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id=_uid FOR UPDATE;
  IF _bal < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  _new := _bal - _amount;
  _ref := 'TX-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  UPDATE public.vtc_wallets
    SET balance_points = _new,
        total_spent = total_spent + _amount,
        updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_amount, _new, _ref, _related_type, _related_id, _note);

  RETURN _new;
END;
$$;

-- Refund (admin / system)
CREATE OR REPLACE FUNCTION public.refund_vtc_points(
  _user_id uuid,
  _amount integer,
  _related_type text,
  _related_id uuid,
  _note text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.vtc_wallets
    SET balance_points = balance_points + _amount,
        total_spent = GREATEST(total_spent - _amount, 0),
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance_points INTO _new;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, related_type, related_id, note
  ) VALUES (_user_id, 'refund', _amount, _new, _related_type, _related_id, _note);

  RETURN _new;
END;
$$;

-- Admin manual adjust
CREATE OR REPLACE FUNCTION public.admin_adjust_vtc_wallet(
  _user_id uuid, _delta integer, _note text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _note IS NULL OR length(trim(_note)) = 0 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.vtc_wallets
    SET balance_points = GREATEST(balance_points + _delta, 0),
        total_recharged = CASE WHEN _delta > 0 THEN total_recharged + _delta ELSE total_recharged END,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance_points INTO _new;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, note
  ) VALUES (_user_id, 'admin_adjust', _delta, _new, _note);

  RETURN _new;
END;
$$;

-- Credit driver earnings (80/20 split)
CREATE OR REPLACE FUNCTION public.credit_driver_earnings(
  _driver_id uuid,
  _trip_id uuid,
  _reservation_id uuid,
  _gross_amount integer,
  _payment_method text DEFAULT 'wallet'
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _fee integer;
  _net integer;
  _new integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
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
END;
$$;
