CREATE OR REPLACE FUNCTION public.compute_app_fees(_svcs text[], _base integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _f record; _amt int; _sum int := 0; _list jsonb := '[]'::jsonb;
BEGIN
  IF COALESCE(_base,0) <= 0 THEN RETURN jsonb_build_object('total',0,'fees','[]'::jsonb); END IF;
  FOR _f IN SELECT name, fee_type, amount FROM public.application_fees
            WHERE is_active AND (service_type IS NULL OR service_type = ANY(_svcs)) ORDER BY created_at LOOP
    _amt := CASE WHEN _f.fee_type = 'percentage' THEN round(_base * _f.amount / 100.0)::int ELSE round(_f.amount)::int END;
    IF _amt > 0 THEN _sum := _sum + _amt; _list := _list || jsonb_build_object('name', _f.name, 'amount', _amt); END IF;
  END LOOP;
  RETURN jsonb_build_object('total', _sum, 'fees', _list);
END $$;
REVOKE EXECUTE ON FUNCTION public.compute_app_fees(text[], integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_application_fees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _svcs text[]; _base int := COALESCE(NEW.total_amount,0); _r jsonb;
BEGIN
  IF _base <= 0 OR (NEW.details ? 'app_fees') THEN RETURN NEW; END IF;
  _svcs := CASE NEW.service_type::text
    WHEN 'TRANSPORT_SCOLAIRE' THEN ARRAY['SCOLAIRE']
    WHEN 'LOCATION_BUS' THEN ARRAY['BUS']
    WHEN 'CIRCUIT_TOURISTIQUE' THEN ARRAY['CIRCUIT']
    WHEN 'LOCATION_CATALOGUE' THEN ARRAY['LOCATION']
    WHEN 'BILLET' THEN ARRAY['BILLET'] ||
      CASE WHEN (NEW.details ? 'train_booking') THEN ARRAY['TRAIN']
           WHEN NEW.details->>'mode' = 'bateau' THEN ARRAY['BATEAU'] ELSE ARRAY[]::text[] END
    ELSE ARRAY[NEW.service_type::text] END;
  _r := public.compute_app_fees(_svcs, _base);
  IF (_r->>'total')::int > 0 THEN
    NEW.details := COALESCE(NEW.details,'{}'::jsonb) || jsonb_build_object('base_amount', _base, 'app_fees', _r->'fees', 'app_fees_total', (_r->>'total')::int);
    NEW.total_amount := _base + (_r->>'total')::int;
  END IF;
  RETURN NEW;
END $$;

-- Flights
ALTER TABLE public.flight_quote_offers ADD COLUMN IF NOT EXISTS app_fees jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.flight_quote_offers ADD COLUMN IF NOT EXISTS app_fees_total integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fqo_on_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _base int; _r jsonb;
BEGIN
  _base := GREATEST(0,
    COALESCE(NEW.price_per_person,0) * GREATEST(COALESCE(NEW.passengers_count,1),1)
    + COALESCE(NEW.fees,0) + COALESCE(NEW.taxes,0) + COALESCE(NEW.service_fee,0)
    - COALESCE(NEW.discount,0));
  _r := public.compute_app_fees(ARRAY['BILLET','AVION'], _base);
  NEW.app_fees := _r->'fees';
  NEW.app_fees_total := (_r->>'total')::int;
  NEW.total_amount := _base + NEW.app_fees_total;

  IF NEW.is_sent AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.is_sent, false)) THEN
    NEW.sent_at := now();
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, details)
    VALUES (NEW.request_id, auth.uid(), 'offer_sent',
            jsonb_build_object('total_amount', NEW.total_amount, 'valid_until', NEW.valid_until));
    UPDATE public.flight_quote_requests
      SET status = 'offer_sent', updated_at = now()
      WHERE id = NEW.request_id AND status IN ('pending','in_progress','offer_sent','expired','refused');
  END IF;
  RETURN NEW;
END; $$;

-- Moving
ALTER TABLE public.moving_quotes ADD COLUMN IF NOT EXISTS app_fees jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.moving_quotes ADD COLUMN IF NOT EXISTS app_fees_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.moving_quotes ADD COLUMN IF NOT EXISTS total_amount integer;

CREATE OR REPLACE FUNCTION public.moving_quote_apply_fees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.price IS NOT DISTINCT FROM OLD.price AND OLD.total_amount IS NOT NULL THEN
    NEW.app_fees := OLD.app_fees; NEW.app_fees_total := OLD.app_fees_total; NEW.total_amount := OLD.total_amount;
    RETURN NEW;
  END IF;
  _r := public.compute_app_fees(ARRAY['DEMENAGEMENT'], COALESCE(NEW.price,0));
  NEW.app_fees := _r->'fees';
  NEW.app_fees_total := (_r->>'total')::int;
  NEW.total_amount := COALESCE(NEW.price,0) + NEW.app_fees_total;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.moving_quote_apply_fees() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS aa_moving_quote_apply_fees ON public.moving_quotes;
CREATE TRIGGER aa_moving_quote_apply_fees BEFORE INSERT OR UPDATE ON public.moving_quotes
FOR EACH ROW EXECUTE FUNCTION public.moving_quote_apply_fees();

CREATE OR REPLACE FUNCTION public.pay_moving_quote_with_wallet(_quote_id uuid)
RETURNS TABLE(new_balance integer, total_paid integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _q public.moving_quotes; _r public.moving_requests;
  _amount integer; _bal integer; _new integer; _ref text; _admin uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO _q FROM public.moving_quotes WHERE id = _quote_id FOR UPDATE;
  IF _q.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO _r FROM public.moving_requests WHERE id = _q.request_id FOR UPDATE;
  IF _r.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _q.status <> 'ACCEPTE' THEN RAISE EXCEPTION 'QUOTE_NOT_ACCEPTED'; END IF;
  IF _r.paid THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;

  _amount := COALESCE(_q.total_amount, _q.price);
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  _new := _bal - _amount;
  _ref := 'DEM-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));
  UPDATE public.vtc_wallets SET balance_points = _new, total_spent = total_spent + _amount, updated_at = now() WHERE user_id = _uid;
  INSERT INTO public.vtc_wallet_transactions(user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note)
  VALUES (_uid, 'trip_payment', -_amount, _new, _ref, 'moving_request', _r.id, 'Paiement déménagement ' || _r.reference_code);
  UPDATE public.moving_requests SET paid = true, paid_amount = _amount, paid_at = now(), updated_at = now() WHERE id = _r.id;
  PERFORM public.notify_user(_uid, 'moving_payment_success', 'Paiement reçu',
    'Votre déménagement ' || _r.reference_code || ' est payé (' || _amount::text || ' FCFA).',
    '/demenagement/' || _r.id::text, '{}'::jsonb);
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.notify_user(_admin, 'moving_payment_success', 'Paiement déménagement reçu',
      _r.full_name || ' — ' || _r.reference_code || ' (' || _amount::text || ' FCFA)',
      '/admin/demenagements', jsonb_build_object('request_id', _r.id));
  END LOOP;
  RETURN QUERY SELECT _new, _amount;
END; $$;