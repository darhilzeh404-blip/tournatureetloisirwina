
-- 1) Drop PawaPay artifacts
DROP FUNCTION IF EXISTS public.apply_pawapay_completion(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.apply_pawapay_failure(uuid, text, text, jsonb) CASCADE;
DROP TABLE IF EXISTS public.pawapay_transactions CASCADE;

-- 2) MyPVit transactions table
CREATE TABLE public.pvit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL UNIQUE, -- ID interne (référence MyPVit)
  merchant_operation_id text UNIQUE, -- ID renvoyé par MyPVit (optionnel)
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XAF',
  operator text NOT NULL, -- airtelmoney | moovmoney
  payer_msisdn text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, SUCCESS, FAILED, EXPIRED
  purpose text NOT NULL CHECK (purpose IN ('reservation','wallet_recharge','partner_booking')),
  related_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiate_response jsonb,
  callback_payload jsonb,
  failure_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_pvit_user ON public.pvit_transactions(user_id);
CREATE INDEX ix_pvit_status ON public.pvit_transactions(status);
CREATE INDEX ix_pvit_related ON public.pvit_transactions(purpose, related_id);

GRANT SELECT, INSERT, UPDATE ON public.pvit_transactions TO authenticated;
GRANT ALL ON public.pvit_transactions TO service_role;

ALTER TABLE public.pvit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_pvit"
  ON public.pvit_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_all_pvit"
  ON public.pvit_transactions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_pvit_updated_at
  BEFORE UPDATE ON public.pvit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Fonction confirmation
CREATE OR REPLACE FUNCTION public.apply_pvit_completion(_transaction_id text, _callback jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  END IF;
END;
$$;

-- 4) Fonction échec
CREATE OR REPLACE FUNCTION public.apply_pvit_failure(_transaction_id text, _status text, _reason text, _callback jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pvit_transactions
    SET status = _status,
        failure_reason = _reason,
        callback_payload = _callback,
        updated_at = now()
    WHERE transaction_id = _transaction_id
      AND status NOT IN ('SUCCESS','FAILED','EXPIRED');
END;
$$;
