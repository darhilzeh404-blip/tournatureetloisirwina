
-- 1) Table pawapay_transactions
CREATE TABLE public.pawapay_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL UNIQUE, -- ID PawaPay (UUID v4)
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XAF',
  provider text NOT NULL, -- AIRTEL_MMO_GAB / MOOV_MMO_GAB
  payer_msisdn text NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, ACCEPTED, COMPLETED, FAILED, REJECTED
  purpose text NOT NULL CHECK (purpose IN ('reservation','wallet_recharge','partner_booking')),
  related_id uuid NOT NULL, -- reservation.id | user_id (recharge) | partner_booking.id
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiate_response jsonb,
  callback_payload jsonb,
  failure_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_pawapay_user ON public.pawapay_transactions(user_id);
CREATE INDEX ix_pawapay_status ON public.pawapay_transactions(status);
CREATE INDEX ix_pawapay_related ON public.pawapay_transactions(purpose, related_id);

-- 2) GRANTS
GRANT SELECT, INSERT, UPDATE ON public.pawapay_transactions TO authenticated;
GRANT ALL ON public.pawapay_transactions TO service_role;

-- 3) RLS
ALTER TABLE public.pawapay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_pawapay"
  ON public.pawapay_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Insert/update passera par SECURITY DEFINER (service role) - policies restrictives sinon
CREATE POLICY "admin_all_pawapay"
  ON public.pawapay_transactions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Updated_at trigger
CREATE TRIGGER trg_pawapay_updated_at
  BEFORE UPDATE ON public.pawapay_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Fonction qui applique un COMPLETED (confirmation auto)
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
  IF _tx.status = 'COMPLETED' THEN RETURN; END IF; -- idempotent

  UPDATE public.pawapay_transactions
    SET status = 'COMPLETED',
        callback_payload = _callback,
        completed_at = now(),
        updated_at = now()
    WHERE id = _tx.id;

  -- Applique selon l'objet
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
          payment_status = 'paid',
          paid_at = now()
      WHERE id = _tx.related_id;
  END IF;
END;
$$;

-- 6) Fonction qui applique un FAILED/REJECTED
CREATE OR REPLACE FUNCTION public.apply_pawapay_failure(_deposit_id uuid, _status text, _reason text, _callback jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pawapay_transactions
    SET status = _status,
        failure_reason = _reason,
        callback_payload = _callback,
        updated_at = now()
    WHERE deposit_id = _deposit_id
      AND status NOT IN ('COMPLETED','FAILED','REJECTED');
END;
$$;
