CREATE OR REPLACE FUNCTION public.sync_partner_booking_on_reservation_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pb uuid;
BEGIN
  IF NEW.paiement_valide IS TRUE AND COALESCE(OLD.paiement_valide, false) IS FALSE THEN
    BEGIN
      _pb := NULLIF(NEW.details->>'partner_booking_id', '')::uuid;
    EXCEPTION WHEN others THEN
      _pb := NULL;
    END;
    IF _pb IS NOT NULL THEN
      UPDATE public.partner_bookings
        SET status = 'confirmed', confirmed_at = now(), updated_at = now()
        WHERE id = _pb AND status NOT IN ('cancelled', 'completed');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_partner_booking_on_reservation_paid ON public.reservations;
CREATE TRIGGER trg_sync_partner_booking_on_reservation_paid
AFTER UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.sync_partner_booking_on_reservation_paid();

-- Sécurité : impossible d'avoir un solde de portefeuille négatif
ALTER TABLE public.vtc_wallets
  DROP CONSTRAINT IF EXISTS vtc_wallets_balance_non_negative;
ALTER TABLE public.vtc_wallets
  ADD CONSTRAINT vtc_wallets_balance_non_negative CHECK (balance_points >= 0);