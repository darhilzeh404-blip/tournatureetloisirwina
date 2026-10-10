CREATE OR REPLACE FUNCTION public.fqo_on_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _base int; _r jsonb;
BEGIN
  IF COALESCE(NEW.price_per_person,0) > 0 THEN
    _base := GREATEST(0,
      NEW.price_per_person * GREATEST(COALESCE(NEW.passengers_count,1),1)
      + COALESCE(NEW.fees,0) + COALESCE(NEW.taxes,0) + COALESCE(NEW.service_fee,0)
      - COALESCE(NEW.discount,0));
  ELSIF TG_OP = 'UPDATE' AND NEW.total_amount IS NOT DISTINCT FROM OLD.total_amount THEN
    -- Unchanged price: never re-apply fees on an already-feed total.
    _base := GREATEST(COALESCE(OLD.total_amount,0) - COALESCE(OLD.app_fees_total,0), 0);
  ELSE
    -- Admin-entered final service price (excluding application fees).
    _base := GREATEST(COALESCE(NEW.total_amount,0), 0);
  END IF;
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