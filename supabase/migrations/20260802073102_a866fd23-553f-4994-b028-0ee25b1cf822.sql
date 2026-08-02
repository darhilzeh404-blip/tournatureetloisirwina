
-- 1) RESERVATIONS : empêcher le client de fixer statut/paiement
DROP POLICY IF EXISTS "Users can create their own reservations" ON public.reservations;
CREATE POLICY "Users can create their own reservations"
ON public.reservations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND paiement_valide = false
  AND coins_awarded = false
  AND status = 'PENDING_PAYMENT'::reservation_status
  AND paid_amount = 0
  AND coins_used >= 0
  AND total_amount >= 0
  AND admin_comment IS NULL
);

-- 2) PAYMENTS : statut forcé PENDING + rattachement à une réservation du client
DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;
CREATE POLICY "Users can create their own payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'PENDING'::payment_status
  AND admin_comment IS NULL
  AND amount > 0
  AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = payments.reservation_id AND r.user_id = auth.uid()
  )
);

-- Validation serveur du montant vs. montant dû
CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_paid numeric;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT total_amount, COALESCE(paid_amount, 0)
    INTO v_total, v_paid
  FROM public.reservations
  WHERE id = NEW.reservation_id;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  IF NEW.amount > GREATEST(v_total - v_paid, 0) THEN
    RAISE EXCEPTION 'Montant du paiement supérieur au montant dû';
  END IF;

  NEW.status := 'PENDING'::payment_status;
  NEW.admin_comment := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_amount ON public.payments;
CREATE TRIGGER trg_validate_payment_amount
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_amount();

-- 3) GROUP RIDE PAYMENTS
DROP POLICY IF EXISTS "Users create own group payments" ON public.group_ride_payments;
CREATE POLICY "Users create own group payments"
ON public.group_ride_payments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'PENDING'
  AND coins_awarded = false
  AND admin_comment IS NULL
  AND amount > 0
  AND EXISTS (
    SELECT 1 FROM public.group_ride_passengers p
    WHERE p.id = group_ride_payments.passenger_id
      AND p.ride_id = group_ride_payments.ride_id
      AND p.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.validate_group_ride_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price integer;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT price_per_seat INTO v_price
  FROM public.group_rides WHERE id = NEW.ride_id;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Course de groupe introuvable';
  END IF;

  IF NEW.amount <> v_price THEN
    RAISE EXCEPTION 'Montant invalide pour cette course de groupe';
  END IF;

  NEW.status := 'PENDING';
  NEW.coins_awarded := false;
  NEW.admin_comment := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_group_ride_payment_amount ON public.group_ride_payments;
CREATE TRIGGER trg_validate_group_ride_payment_amount
BEFORE INSERT ON public.group_ride_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_group_ride_payment_amount();
