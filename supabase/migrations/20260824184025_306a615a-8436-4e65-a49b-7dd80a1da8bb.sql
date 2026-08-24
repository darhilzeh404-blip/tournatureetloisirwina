-- 1. Historique unifié : distinguer gains et retraits
ALTER TABLE public.driver_wallet_transactions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'earning',
  ADD COLUMN IF NOT EXISTS reference text;

-- Anti double-crédit : une seule ligne de gain par course
DELETE FROM public.driver_wallet_transactions a
 USING public.driver_wallet_transactions b
 WHERE a.trip_id IS NOT NULL AND a.trip_id = b.trip_id
   AND COALESCE(a.kind,'earning') = 'earning' AND COALESCE(b.kind,'earning') = 'earning'
   AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS driver_wallet_tx_unique_earning_per_trip
  ON public.driver_wallet_transactions (trip_id)
  WHERE trip_id IS NOT NULL AND kind = 'earning';

-- 2. Crédit idempotent
CREATE OR REPLACE FUNCTION public.credit_driver_earnings(
  _driver_id uuid, _trip_id uuid, _reservation_id uuid,
  _gross_amount integer, _payment_method text DEFAULT 'wallet'::text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _fee integer; _net integer; _new integer; _inserted uuid;
BEGIN
  IF _gross_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  _fee := (_gross_amount * 20) / 100;
  _net := _gross_amount - _fee;

  INSERT INTO public.driver_wallets(driver_id) VALUES (_driver_id) ON CONFLICT (driver_id) DO NOTHING;

  INSERT INTO public.driver_wallet_transactions(
    driver_id, trip_id, reservation_id, gross_amount, platform_fee, net_amount,
    payment_method, kind, reference
  ) VALUES (
    _driver_id, _trip_id, _reservation_id, _gross_amount, _fee, _net,
    _payment_method, 'earning', 'TRIP-' || COALESCE(_trip_id::text, gen_random_uuid()::text)
  )
  ON CONFLICT (trip_id) WHERE trip_id IS NOT NULL AND kind = 'earning' DO NOTHING
  RETURNING id INTO _inserted;

  IF _inserted IS NULL THEN
    -- Déjà crédité pour cette course : on renvoie le solde inchangé.
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

-- 3. Demandes de retrait
CREATE TABLE IF NOT EXISTS public.driver_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  deposit_number text NOT NULL,
  method text NOT NULL DEFAULT 'mobile_money',
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  reference text NOT NULL DEFAULT ('WD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.driver_withdrawals TO authenticated;
GRANT ALL ON public.driver_withdrawals TO service_role;

ALTER TABLE public.driver_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals_select_self_or_admin" ON public.driver_withdrawals;
CREATE POLICY "withdrawals_select_self_or_admin" ON public.driver_withdrawals
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "block_anon_withdrawals" ON public.driver_withdrawals;
CREATE POLICY "block_anon_withdrawals" ON public.driver_withdrawals
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS driver_withdrawals_driver_idx
  ON public.driver_withdrawals (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS driver_withdrawals_status_idx
  ON public.driver_withdrawals (status, created_at DESC);

DROP TRIGGER IF EXISTS driver_withdrawals_set_updated_at ON public.driver_withdrawals;
CREATE TRIGGER driver_withdrawals_set_updated_at
  BEFORE UPDATE ON public.driver_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Demande de retrait (chauffeur) — solde vérifié serveur, réservations en attente déduites
CREATE OR REPLACE FUNCTION public.request_driver_withdrawal(
  _amount integer, _deposit_number text, _method text DEFAULT 'mobile_money')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _balance integer := 0;
  _pending integer := 0;
  _id uuid;
  _num text := regexp_replace(COALESCE(_deposit_number,''), '[^0-9+]', '', 'g');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'chauffeur'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _amount IS NULL OR _amount < 1000 THEN RAISE EXCEPTION 'MIN_AMOUNT'; END IF;
  IF length(_num) < 8 THEN RAISE EXCEPTION 'INVALID_DEPOSIT_NUMBER'; END IF;
  IF _method NOT IN ('mobile_money','airtel_money','moov_money','cash_agent','bank_transfer') THEN
    RAISE EXCEPTION 'INVALID_METHOD';
  END IF;

  SELECT balance_earnings INTO _balance FROM public.driver_wallets
    WHERE driver_id = _uid FOR UPDATE;
  IF _balance IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  SELECT COALESCE(SUM(amount),0) INTO _pending FROM public.driver_withdrawals
    WHERE driver_id = _uid AND status = 'pending';

  IF _amount > (_balance - _pending) THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  INSERT INTO public.driver_withdrawals(driver_id, amount, deposit_number, method)
  VALUES (_uid, _amount, _num, _method)
  RETURNING id INTO _id;

  PERFORM public.notify_admins(
    'Nouvelle demande de retrait',
    'Un chauffeur demande un retrait de ' || _amount::text || ' FCFA.',
    'withdrawal', _id::text
  );
  RETURN _id;
END; $function$;

-- 5. Validation admin — atomique, non rejouable
CREATE OR REPLACE FUNCTION public.admin_decide_withdrawal(
  _withdrawal_id uuid, _approve boolean, _note text DEFAULT NULL)
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

  -- Verrou : la transition pending -> (paid|rejected) ne peut réussir qu'une fois.
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

  SELECT balance_earnings INTO _balance FROM public.driver_wallets
    WHERE driver_id = _wd.driver_id FOR UPDATE;
  IF COALESCE(_balance,0) < _wd.amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  UPDATE public.driver_wallets
     SET balance_earnings = balance_earnings - _wd.amount, updated_at = now()
   WHERE driver_id = _wd.driver_id
  RETURNING balance_earnings INTO _balance;

  INSERT INTO public.driver_wallet_transactions(
    driver_id, gross_amount, platform_fee, net_amount, payment_method, kind, reference, status, note
  ) VALUES (
    _wd.driver_id, _wd.amount, 0, -_wd.amount, _wd.method, 'withdrawal', _wd.reference, 'completed',
    'Retrait vers ' || _wd.deposit_number
  );

  PERFORM public.notify_user(_wd.driver_id, 'Retrait validé',
    'Votre retrait de ' || _wd.amount::text || ' FCFA a été validé.', 'withdrawal', _wd.id::text);

  RETURN QUERY SELECT 'paid'::text, COALESCE(_balance,0);
END; $function$;

REVOKE ALL ON FUNCTION public.request_driver_withdrawal(integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decide_withdrawal(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_driver_withdrawal(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_withdrawal(uuid, boolean, text) TO authenticated;