-- Unified managed-ticket workflow for flights, trains and boats.
-- An accepted offer is represented by a normal reservation so the existing
-- Wallet/MyPVIT payment and receipt mechanisms remain the only payment path.

DO $$
BEGIN
  ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'BILLET_AVION';
  ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'BILLET_TRAIN';
  ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'BILLET_BATEAU';
EXCEPTION WHEN undefined_object THEN
  RAISE EXCEPTION 'service_type is required before applying ticket workflow';
END $$;

CREATE TABLE IF NOT EXISTS public.ticket_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT ('BT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_type text NOT NULL CHECK (ticket_type IN ('flight', 'train', 'boat')),
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  origin text NOT NULL,
  destination text NOT NULL,
  trip_type text NOT NULL DEFAULT 'one_way' CHECK (trip_type IN ('one_way', 'round_trip')),
  departure_date date NOT NULL,
  return_date date,
  passengers jsonb NOT NULL DEFAULT '[]'::jsonb,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'offer_sent', 'accepted_pending_payment', 'refused', 'paid', 'ticket_issued', 'cancelled', 'expired')),
  refusal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((trip_type = 'round_trip') = (return_date IS NOT NULL)),
  CHECK (jsonb_typeof(passengers) = 'array')
);

CREATE TABLE IF NOT EXISTS public.ticket_quote_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.ticket_quote_requests(id) ON DELETE CASCADE,
  reservation_id uuid UNIQUE REFERENCES public.reservations(id) ON DELETE SET NULL,
  provider_name text NOT NULL,
  booking_reference text,
  ticket_number text,
  itinerary jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions text,
  total_amount integer NOT NULL CHECK (total_amount > 0),
  valid_until timestamptz NOT NULL,
  admin_note text,
  ticket_file_path text,
  is_sent boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_quote_requests_owner_idx
  ON public.ticket_quote_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_quote_requests_status_idx
  ON public.ticket_quote_requests(ticket_type, status, created_at DESC);

ALTER TABLE public.ticket_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_quote_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_request_owner_select ON public.ticket_quote_requests;
CREATE POLICY ticket_request_owner_select ON public.ticket_quote_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS ticket_request_owner_insert ON public.ticket_quote_requests;
CREATE POLICY ticket_request_owner_insert ON public.ticket_quote_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS ticket_request_admin_update ON public.ticket_quote_requests;
CREATE POLICY ticket_request_admin_update ON public.ticket_quote_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS ticket_offer_visible_to_owner ON public.ticket_quote_offers;
CREATE POLICY ticket_offer_visible_to_owner ON public.ticket_quote_offers
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ticket_quote_requests r WHERE r.id = request_id
      AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
DROP POLICY IF EXISTS ticket_offer_admin_write ON public.ticket_quote_offers;
CREATE POLICY ticket_offer_admin_write ON public.ticket_quote_offers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.ticket_quote_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS ticket_quote_requests_updated_at ON public.ticket_quote_requests;
CREATE TRIGGER ticket_quote_requests_updated_at BEFORE UPDATE ON public.ticket_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.ticket_quote_updated_at();
DROP TRIGGER IF EXISTS ticket_quote_offers_updated_at ON public.ticket_quote_offers;
CREATE TRIGGER ticket_quote_offers_updated_at BEFORE UPDATE ON public.ticket_quote_offers
  FOR EACH ROW EXECUTE FUNCTION public.ticket_quote_updated_at();

CREATE OR REPLACE FUNCTION public.admin_send_ticket_offer(
  _request_id uuid, _provider_name text, _total_amount integer, _valid_until timestamptz,
  _booking_reference text DEFAULT NULL, _ticket_number text DEFAULT NULL,
  _itinerary jsonb DEFAULT '{}'::jsonb, _conditions text DEFAULT NULL, _admin_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ticket_quote_requests; o public.ticket_quote_offers; reservation_service public.service_type; _reservation_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(btrim(_provider_name), '') = '' OR _total_amount <= 0 OR _valid_until <= now() THEN RAISE EXCEPTION 'INVALID_OFFER'; END IF;
  SELECT * INTO r FROM public.ticket_quote_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.status IN ('paid', 'ticket_issued', 'cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  reservation_service := CASE r.ticket_type
    WHEN 'flight' THEN 'BILLET_AVION'::public.service_type
    WHEN 'train' THEN 'BILLET_TRAIN'::public.service_type
    ELSE 'BILLET_BATEAU'::public.service_type END;

  SELECT * INTO o FROM public.ticket_quote_offers WHERE request_id = _request_id FOR UPDATE;
  _reservation_id := o.reservation_id;
  IF _reservation_id IS NULL THEN
    INSERT INTO public.reservations(user_id, service_type, reservation_date, total_amount, status, details)
    VALUES (r.user_id, reservation_service, r.departure_date, _total_amount, 'PENDING_PAYMENT',
      jsonb_build_object('ticket_request_id', r.id, 'ticket_type', r.ticket_type,
        'request_number', r.request_number, 'origin', r.origin, 'destination', r.destination,
        'departure_date', r.departure_date, 'return_date', r.return_date,
        'passengers', r.passengers,
        'adults', coalesce((r.passengers->0->>'count')::integer, 0),
        'children', coalesce((r.passengers->1->>'count')::integer, 0),
        'passengers_count', coalesce((r.passengers->0->>'count')::integer, 0) + coalesce((r.passengers->1->>'count')::integer, 0),
        'provider_name', _provider_name, 'booking_reference', _booking_reference))
    RETURNING id INTO _reservation_id;
  ELSE
    UPDATE public.reservations SET total_amount = _total_amount, reservation_date = r.departure_date,
      status = 'PENDING_PAYMENT', paid_amount = 0,
      details = details || jsonb_build_object('provider_name', _provider_name, 'booking_reference', _booking_reference)
      WHERE id = _reservation_id;
  END IF;
  INSERT INTO public.ticket_quote_offers(request_id, reservation_id, provider_name, booking_reference, ticket_number, itinerary, conditions, total_amount, valid_until, admin_note, is_sent, created_by)
  VALUES (_request_id, _reservation_id, btrim(_provider_name), nullif(btrim(_booking_reference), ''), nullif(btrim(_ticket_number), ''),
    coalesce(_itinerary, '{}'::jsonb), nullif(btrim(_conditions), ''), _total_amount, _valid_until, nullif(btrim(_admin_note), ''), true, auth.uid())
  ON CONFLICT (request_id) DO UPDATE SET reservation_id = EXCLUDED.reservation_id, provider_name = EXCLUDED.provider_name,
    booking_reference = EXCLUDED.booking_reference, ticket_number = EXCLUDED.ticket_number, itinerary = EXCLUDED.itinerary,
    conditions = EXCLUDED.conditions, total_amount = EXCLUDED.total_amount, valid_until = EXCLUDED.valid_until,
    admin_note = EXCLUDED.admin_note, is_sent = true, created_by = auth.uid(), updated_at = now()
  RETURNING id INTO o.id;
  UPDATE public.ticket_quote_requests SET status = 'offer_sent', refusal_reason = NULL WHERE id = _request_id;
  RETURN _reservation_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_send_ticket_offer(uuid,text,integer,timestamptz,text,text,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_ticket_offer(uuid,text,integer,timestamptz,text,text,jsonb,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_ticket_offer(_request_id uuid, _accept boolean, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ticket_quote_requests; o public.ticket_quote_offers;
BEGIN
  SELECT * INTO r FROM public.ticket_quote_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.user_id <> auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF r.status <> 'offer_sent' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT * INTO o FROM public.ticket_quote_offers WHERE request_id = _request_id AND is_sent FOR UPDATE;
  IF NOT FOUND OR o.reservation_id IS NULL THEN RAISE EXCEPTION 'NO_OFFER'; END IF;
  IF o.valid_until <= now() THEN UPDATE public.ticket_quote_requests SET status = 'expired' WHERE id = _request_id; RAISE EXCEPTION 'OFFER_EXPIRED'; END IF;
  IF _accept THEN
    UPDATE public.ticket_quote_requests SET status = 'accepted_pending_payment' WHERE id = _request_id;
    RETURN o.reservation_id;
  END IF;
  UPDATE public.ticket_quote_requests SET status = 'refused', refusal_reason = nullif(btrim(coalesce(_reason, '')), '') WHERE id = _request_id;
  UPDATE public.reservations SET status = 'CANCELLED' WHERE id = o.reservation_id AND paid_amount = 0;
  RETURN o.reservation_id;
END; $$;
REVOKE ALL ON FUNCTION public.respond_ticket_offer(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_ticket_offer(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_ticket_request_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_id uuid;
BEGIN
  request_id := nullif(NEW.details->>'ticket_request_id', '')::uuid;
  IF request_id IS NOT NULL AND (NEW.status = 'CONFIRMED' OR NEW.paid_amount >= NEW.total_amount) THEN
    UPDATE public.ticket_quote_requests SET status = 'paid' WHERE id = request_id AND status <> 'ticket_issued';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ticket_request_payment_sync ON public.reservations;
CREATE TRIGGER ticket_request_payment_sync AFTER UPDATE OF status, paid_amount ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_request_payment();

INSERT INTO storage.buckets(id, name, public) VALUES ('ticket-documents', 'ticket-documents', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS ticket_docs_admin_insert ON storage.objects;
CREATE POLICY ticket_docs_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-documents' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS ticket_docs_owner_or_admin_read ON storage.objects;
CREATE POLICY ticket_docs_owner_or_admin_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-documents' AND (public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.ticket_quote_offers o JOIN public.ticket_quote_requests r ON r.id = o.request_id
      WHERE o.ticket_file_path = name AND r.user_id = auth.uid())));
