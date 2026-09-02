-- 1) Revoke EXECUTE from anon/PUBLIC on all SECURITY DEFINER functions in public,
--    and from authenticated on trigger functions (never meant to be called via API).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- 2) Storage: stop anonymous listing of public buckets (public URL rendering unaffected)
DROP POLICY IF EXISTS "Public can view circuit images" ON storage.objects;
DROP POLICY IF EXISTS "Public read ticket-images" ON storage.objects;

CREATE POLICY "Staff list circuit-images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'circuit-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerant'::app_role)));

CREATE POLICY "Staff list ticket-images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ticket-images' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerant'::app_role) OR has_role(auth.uid(), 'agence'::app_role)));

-- 3) Validate coins spent on gift redemptions and lottery entries
CREATE OR REPLACE FUNCTION public.validate_gift_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _cost INTEGER; _balance INTEGER;
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  SELECT coins_cost INTO _cost FROM public.wina_gifts WHERE id = NEW.gift_id AND is_active;
  IF _cost IS NULL THEN RAISE EXCEPTION 'GIFT_NOT_FOUND'; END IF;
  IF COALESCE(NEW.coins_spent, 0) <> _cost THEN RAISE EXCEPTION 'INVALID_COINS_SPENT'; END IF;
  SELECT coins_balance INTO _balance FROM public.wina_coin_balances WHERE user_id = NEW.user_id;
  IF COALESCE(_balance, 0) < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
  NEW.status := 'pending'::gift_redemption_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_gift_redemption ON public.wina_gift_redemptions;
CREATE TRIGGER trg_validate_gift_redemption
BEFORE INSERT ON public.wina_gift_redemptions
FOR EACH ROW EXECUTE FUNCTION public.validate_gift_redemption();

CREATE OR REPLACE FUNCTION public.validate_lottery_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _lottery public.wina_lotteries; _balance INTEGER; _count INTEGER;
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  SELECT * INTO _lottery FROM public.wina_lotteries WHERE id = NEW.lottery_id;
  IF _lottery.id IS NULL THEN RAISE EXCEPTION 'LOTTERY_NOT_FOUND'; END IF;
  IF _lottery.status <> 'open' OR _lottery.draw_date <= now() THEN RAISE EXCEPTION 'LOTTERY_CLOSED'; END IF;
  IF COALESCE(NEW.coins_spent, 0) <> _lottery.entry_cost_coins THEN RAISE EXCEPTION 'INVALID_COINS_SPENT'; END IF;
  SELECT COUNT(*) INTO _count FROM public.wina_lottery_entries WHERE lottery_id = NEW.lottery_id AND user_id = NEW.user_id;
  IF _count + 1 > _lottery.max_entries_per_user THEN RAISE EXCEPTION 'MAX_ENTRIES_EXCEEDED'; END IF;
  SELECT coins_balance INTO _balance FROM public.wina_coin_balances WHERE user_id = NEW.user_id;
  IF COALESCE(_balance, 0) < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lottery_entry ON public.wina_lottery_entries;
CREATE TRIGGER trg_validate_lottery_entry
BEFORE INSERT ON public.wina_lottery_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_lottery_entry();

REVOKE ALL ON FUNCTION public.validate_gift_redemption() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_lottery_entry() FROM PUBLIC, anon, authenticated;