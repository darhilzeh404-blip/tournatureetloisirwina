
-- ============ vip_levels ============
CREATE TABLE public.vip_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_name text NOT NULL UNIQUE,
  min_coins integer NOT NULL DEFAULT 0,
  bonus_percentage integer NOT NULL DEFAULT 0,
  badge_icon text NOT NULL DEFAULT 'medal',
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vip_levels TO anon, authenticated;
GRANT ALL ON public.vip_levels TO service_role;
ALTER TABLE public.vip_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view vip_levels" ON public.vip_levels FOR SELECT USING (true);
CREATE POLICY "Admins manage vip_levels" ON public.vip_levels FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.vip_levels (level_name, min_coins, bonus_percentage, badge_icon, sort_order, benefits) VALUES
  ('Silver', 0, 0, 'silver', 1, '["Accumulez des coins à chaque réservation validée"]'::jsonb),
  ('Gold', 500, 10, 'gold', 2, '["+10% de bonus sur les coins gagnés","Participation au tirage cadeau"]'::jsonb),
  ('Platinum', 2000, 20, 'platinum', 3, '["+20% de bonus sur les coins","Remises exclusives 7 jours"]'::jsonb),
  ('Diamond', 5000, 35, 'diamond', 4, '["+35% de bonus sur les coins","Accès à la tombola week-end touristique"]'::jsonb),
  ('Diamond+', 12000, 50, 'diamond-plus', 5, '["+50% de bonus sur les coins","Accès prioritaire aux offres","Tombola iPhone, TV, électroménager"]'::jsonb);

-- ============ wina_coin_balances ============
CREATE TABLE public.wina_coin_balances (
  user_id uuid PRIMARY KEY,
  coins_balance integer NOT NULL DEFAULT 0,
  total_coins_earned integer NOT NULL DEFAULT 0,
  total_reservations integer NOT NULL DEFAULT 0,
  vip_level_id uuid REFERENCES public.vip_levels(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wina_coin_balances TO authenticated;
GRANT ALL ON public.wina_coin_balances TO service_role;
ALTER TABLE public.wina_coin_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own balance" ON public.wina_coin_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all balances" ON public.wina_coin_balances FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update balances" ON public.wina_coin_balances FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ wina_coins_history ============
CREATE TABLE public.wina_coins_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reservation_id uuid,
  reservation_type text,
  amount_paid integer NOT NULL DEFAULT 0,
  coins_earned integer NOT NULL DEFAULT 0,
  bonus_percentage integer NOT NULL DEFAULT 0,
  operation_type text NOT NULL CHECK (operation_type IN ('earn','spend','refund','admin_adjust')),
  status text NOT NULL DEFAULT 'completed',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wina_coins_history_unique_earn ON public.wina_coins_history(reservation_id, operation_type) WHERE reservation_id IS NOT NULL AND operation_type = 'earn';
CREATE INDEX wina_coins_history_user_idx ON public.wina_coins_history(user_id, created_at DESC);
GRANT SELECT ON public.wina_coins_history TO authenticated;
GRANT ALL ON public.wina_coins_history TO service_role;
ALTER TABLE public.wina_coins_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own history" ON public.wina_coins_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all history" ON public.wina_coins_history FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ reservations additions ============
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS coins_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_awarded boolean NOT NULL DEFAULT false;

-- ============ helper: recompute_vip_level ============
CREATE OR REPLACE FUNCTION public.recompute_vip_level(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total integer;
  _level_id uuid;
BEGIN
  SELECT COALESCE(total_coins_earned, 0) INTO _total FROM public.wina_coin_balances WHERE user_id = _user_id;
  IF _total IS NULL THEN _total := 0; END IF;
  SELECT id INTO _level_id FROM public.vip_levels WHERE min_coins <= _total ORDER BY min_coins DESC LIMIT 1;
  UPDATE public.wina_coin_balances SET vip_level_id = _level_id, updated_at = now() WHERE user_id = _user_id;
  RETURN _level_id;
END;
$$;

-- ============ award_wina_coins ============
CREATE OR REPLACE FUNCTION public.award_wina_coins(_reservation_id uuid)
RETURNS TABLE(coins_earned integer, new_balance integer, vip_level_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _res public.reservations;
  _bonus integer := 0;
  _base integer;
  _coins integer;
  _net_amount integer;
  _level public.vip_levels;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO _res FROM public.reservations WHERE id = _reservation_id;
  IF _res.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_FOUND'; END IF;
  IF _res.coins_awarded THEN
    RETURN QUERY SELECT 0, COALESCE((SELECT b.coins_balance FROM public.wina_coin_balances b WHERE b.user_id = _res.user_id), 0), (SELECT b.vip_level_id FROM public.wina_coin_balances b WHERE b.user_id = _res.user_id);
    RETURN;
  END IF;

  -- ensure balance row exists
  INSERT INTO public.wina_coin_balances(user_id) VALUES (_res.user_id) ON CONFLICT (user_id) DO NOTHING;

  -- determine current VIP bonus
  SELECT v.* INTO _level
    FROM public.wina_coin_balances b
    LEFT JOIN public.vip_levels v ON v.id = b.vip_level_id
    WHERE b.user_id = _res.user_id;
  IF _level.id IS NULL THEN
    SELECT * INTO _level FROM public.vip_levels ORDER BY min_coins ASC LIMIT 1;
  END IF;
  _bonus := COALESCE(_level.bonus_percentage, 0);

  -- net amount = total - coins_used (coins are 1 coin = 1 FCFA)
  _net_amount := GREATEST(COALESCE(_res.total_amount,0) - COALESCE(_res.coins_used,0), 0);
  _base := (_net_amount / 1000) * 10;
  _coins := _base + (_base * _bonus / 100);

  IF _coins > 0 THEN
    INSERT INTO public.wina_coins_history(user_id, reservation_id, reservation_type, amount_paid, coins_earned, bonus_percentage, operation_type)
    VALUES (_res.user_id, _reservation_id, _res.service_type::text, _net_amount, _coins, _bonus, 'earn');
  END IF;

  UPDATE public.wina_coin_balances
    SET coins_balance = coins_balance + _coins,
        total_coins_earned = total_coins_earned + _coins,
        total_reservations = total_reservations + 1,
        updated_at = now()
    WHERE user_id = _res.user_id;

  UPDATE public.reservations SET coins_awarded = true, updated_at = now() WHERE id = _reservation_id;

  PERFORM public.recompute_vip_level(_res.user_id);

  RETURN QUERY
    SELECT _coins,
           (SELECT b.coins_balance FROM public.wina_coin_balances b WHERE b.user_id = _res.user_id),
           (SELECT b.vip_level_id FROM public.wina_coin_balances b WHERE b.user_id = _res.user_id);
END;
$$;

-- ============ refund_wina_coins ============
CREATE OR REPLACE FUNCTION public.refund_wina_coins(_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _res public.reservations;
  _earned integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO _res FROM public.reservations WHERE id = _reservation_id;
  IF _res.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_FOUND'; END IF;

  SELECT COALESCE(SUM(coins_earned),0) INTO _earned
    FROM public.wina_coins_history
    WHERE reservation_id = _reservation_id AND operation_type = 'earn' AND status = 'completed';

  IF _earned > 0 THEN
    UPDATE public.wina_coins_history SET status = 'cancelled'
      WHERE reservation_id = _reservation_id AND operation_type = 'earn';
    INSERT INTO public.wina_coins_history(user_id, reservation_id, reservation_type, amount_paid, coins_earned, operation_type, note)
      VALUES (_res.user_id, _reservation_id, _res.service_type::text, 0, -_earned, 'refund', 'Réservation annulée');
    UPDATE public.wina_coin_balances
      SET coins_balance = GREATEST(coins_balance - _earned, 0),
          total_coins_earned = GREATEST(total_coins_earned - _earned, 0),
          updated_at = now()
      WHERE user_id = _res.user_id;
  END IF;

  -- restore spent coins
  IF COALESCE(_res.coins_used,0) > 0 THEN
    INSERT INTO public.wina_coins_history(user_id, reservation_id, reservation_type, amount_paid, coins_earned, operation_type, note)
      VALUES (_res.user_id, _reservation_id, _res.service_type::text, 0, _res.coins_used, 'refund', 'Coins restitués (annulation)');
    UPDATE public.wina_coin_balances
      SET coins_balance = coins_balance + _res.coins_used, updated_at = now()
      WHERE user_id = _res.user_id;
    UPDATE public.reservations SET coins_used = 0, updated_at = now() WHERE id = _reservation_id;
  END IF;

  UPDATE public.reservations SET coins_awarded = false, updated_at = now() WHERE id = _reservation_id;
  PERFORM public.recompute_vip_level(_res.user_id);
END;
$$;

-- ============ spend_wina_coins ============
CREATE OR REPLACE FUNCTION public.spend_wina_coins(_reservation_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _res public.reservations;
  _balance integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT * INTO _res FROM public.reservations WHERE id = _reservation_id;
  IF _res.id IS NULL OR _res.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _res.coins_awarded THEN RAISE EXCEPTION 'ALREADY_VALIDATED'; END IF;
  IF COALESCE(_res.coins_used,0) > 0 THEN RAISE EXCEPTION 'ALREADY_SPENT'; END IF;

  INSERT INTO public.wina_coin_balances(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT coins_balance INTO _balance FROM public.wina_coin_balances WHERE user_id = _uid FOR UPDATE;
  IF _balance < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
  IF _amount > _res.total_amount THEN _amount := _res.total_amount; END IF;

  UPDATE public.wina_coin_balances SET coins_balance = coins_balance - _amount, updated_at = now() WHERE user_id = _uid;
  UPDATE public.reservations SET coins_used = _amount, updated_at = now() WHERE id = _reservation_id;
  INSERT INTO public.wina_coins_history(user_id, reservation_id, reservation_type, amount_paid, coins_earned, operation_type, note)
    VALUES (_uid, _reservation_id, _res.service_type::text, _amount, -_amount, 'spend', 'Réduction appliquée');

  RETURN _amount;
END;
$$;

-- ============ admin_adjust_coins ============
CREATE OR REPLACE FUNCTION public.admin_adjust_coins(_user_id uuid, _delta integer, _note text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _balance integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _note IS NULL OR length(trim(_note)) = 0 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
  INSERT INTO public.wina_coin_balances(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wina_coin_balances
    SET coins_balance = GREATEST(coins_balance + _delta, 0),
        total_coins_earned = CASE WHEN _delta > 0 THEN total_coins_earned + _delta ELSE total_coins_earned END,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING coins_balance INTO _balance;
  INSERT INTO public.wina_coins_history(user_id, amount_paid, coins_earned, operation_type, note)
    VALUES (_user_id, 0, _delta, 'admin_adjust', _note);
  PERFORM public.recompute_vip_level(_user_id);
  RETURN _balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_wina_coins(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_wina_coins(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_wina_coins(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_coins(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_vip_level(uuid) TO authenticated;
