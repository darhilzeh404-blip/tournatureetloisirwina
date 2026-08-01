-- =========================================================
-- REFONTE MODULE VOLS : demande de devis aérien
-- =========================================================

DROP TABLE IF EXISTS public.flight_booking_delivery_logs CASCADE;
DROP TABLE IF EXISTS public.flight_booking_tracking CASCADE;
DROP TABLE IF EXISTS public.flight_booking_payments CASCADE;
DROP TABLE IF EXISTS public.flight_booking_passengers CASCADE;
DROP TABLE IF EXISTS public.flight_bookings CASCADE;
DROP TABLE IF EXISTS public.flight_program_segments CASCADE;
DROP TABLE IF EXISTS public.flight_program_files CASCADE;
DROP TABLE IF EXISTS public.flight_pickup_locations CASCADE;
DROP TABLE IF EXISTS public.flight_programs CASCADE;
DROP FUNCTION IF EXISTS public.pay_flight_booking_with_wallet(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.flight_bookings_manage_seats() CASCADE;
DROP FUNCTION IF EXISTS public.flight_bookings_track_status() CASCADE;

-- ---------------------------------------------------------
-- Notifications utilisateurs (générique)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications(user_id, is_read, created_at DESC);

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "un_select_own" ON public.user_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "un_update_own" ON public.user_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "un_block_anon" ON public.user_notifications
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- ---------------------------------------------------------
-- Programmes de vols (informatifs)
-- ---------------------------------------------------------
CREATE TABLE public.flight_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE RESTRICT,
  origin text NOT NULL,
  destination text NOT NULL,
  price_from integer NOT NULL DEFAULT 0 CHECK (price_from >= 0),
  currency text NOT NULL DEFAULT 'XAF',
  month_start date NOT NULL,
  month_end date NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','suspended','full')),
  description text,
  conditions text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flight_programs_route ON public.flight_programs(origin, destination);
CREATE INDEX idx_flight_programs_month ON public.flight_programs(month_start, month_end);

GRANT SELECT ON public.flight_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_programs TO authenticated;
GRANT ALL ON public.flight_programs TO service_role;
ALTER TABLE public.flight_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_public_read" ON public.flight_programs
  FOR SELECT USING (is_active = true AND status IN ('available','full'));
CREATE POLICY "fp_admin_read" ON public.flight_programs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fp_admin_write" ON public.flight_programs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_flight_programs_updated BEFORE UPDATE ON public.flight_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- Demandes de devis
-- ---------------------------------------------------------
CREATE TABLE public.flight_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT 'DV-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8)),
  user_id uuid NOT NULL,
  program_id uuid REFERENCES public.flight_programs(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  origin text NOT NULL,
  destination text NOT NULL,
  trip_type text NOT NULL DEFAULT 'one_way' CHECK (trip_type IN ('one_way','round_trip')),
  departure_date date NOT NULL,
  return_date date,
  adults integer NOT NULL DEFAULT 1 CHECK (adults >= 1),
  children integer NOT NULL DEFAULT 0 CHECK (children >= 0),
  infants integer NOT NULL DEFAULT 0 CHECK (infants >= 0),
  client_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','offer_sent','refused','accepted_pending_payment','paid','ticket_issued','completed','cancelled','expired')),
  paid_at timestamptz,
  ticket_pdf_url text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fqr_user ON public.flight_quote_requests(user_id, created_at DESC);
CREATE INDEX idx_fqr_status ON public.flight_quote_requests(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.flight_quote_requests TO authenticated;
GRANT ALL ON public.flight_quote_requests TO service_role;
ALTER TABLE public.flight_quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fqr_select" ON public.flight_quote_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fqr_insert_own" ON public.flight_quote_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "fqr_admin_update" ON public.flight_quote_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fqr_block_anon" ON public.flight_quote_requests
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE TRIGGER trg_fqr_updated BEFORE UPDATE ON public.flight_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- Offres administrateur
-- ---------------------------------------------------------
CREATE TABLE public.flight_quote_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.flight_quote_requests(id) ON DELETE CASCADE,
  airline_name text NOT NULL,
  flight_number text,
  flight_date date,
  departure_time text,
  arrival_time text,
  duration text,
  stopovers text,
  travel_class text,
  cabin_baggage text,
  checked_baggage text,
  conditions text,
  unit_price integer NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount integer NOT NULL CHECK (total_amount > 0),
  valid_until timestamptz NOT NULL,
  comments text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_quote_offers TO authenticated;
GRANT ALL ON public.flight_quote_offers TO service_role;
ALTER TABLE public.flight_quote_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fqo_select" ON public.flight_quote_offers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "fqo_admin_write" ON public.flight_quote_offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fqo_block_anon" ON public.flight_quote_offers
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE TRIGGER trg_fqo_updated BEFORE UPDATE ON public.flight_quote_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- Passagers
-- ---------------------------------------------------------
CREATE TABLE public.flight_quote_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.flight_quote_requests(id) ON DELETE CASCADE,
  passenger_type text NOT NULL CHECK (passenger_type IN ('adult','child','infant')),
  last_name text NOT NULL,
  first_name text NOT NULL,
  gender text,
  birth_date date,
  nationality text,
  doc_type text,
  doc_number text,
  doc_expiry date,
  doc_country text,
  phone text,
  email text,
  guardian_name text,
  guardian_relation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fqp_request ON public.flight_quote_passengers(request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_quote_passengers TO authenticated;
GRANT ALL ON public.flight_quote_passengers TO service_role;
ALTER TABLE public.flight_quote_passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fqp_all_owner_or_admin" ON public.flight_quote_passengers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "fqp_block_anon" ON public.flight_quote_passengers
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE TRIGGER trg_fqp_updated BEFORE UPDATE ON public.flight_quote_passengers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Un bébé doit être rattaché à un adulte accompagnateur
CREATE OR REPLACE FUNCTION public.fqp_validate_infant()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.passenger_type = 'infant' AND (NEW.guardian_name IS NULL OR btrim(NEW.guardian_name) = '') THEN
    RAISE EXCEPTION 'INFANT_REQUIRES_GUARDIAN';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_fqp_infant BEFORE INSERT OR UPDATE ON public.flight_quote_passengers
  FOR EACH ROW EXECUTE FUNCTION public.fqp_validate_infant();

-- ---------------------------------------------------------
-- Historique / traçabilité
-- ---------------------------------------------------------
CREATE TABLE public.flight_quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.flight_quote_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status text,
  to_status text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fqe_request ON public.flight_quote_events(request_id, created_at DESC);

GRANT SELECT ON public.flight_quote_events TO authenticated;
GRANT ALL ON public.flight_quote_events TO service_role;
ALTER TABLE public.flight_quote_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fqe_select" ON public.flight_quote_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "fqe_block_anon" ON public.flight_quote_events
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- ---------------------------------------------------------
-- Helpers notification
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _message text, _link text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_notifications(user_id, type, title, message, link, payload)
  SELECT ur.user_id, _type, _title, _message, _link, _payload
  FROM public.user_roles ur WHERE ur.role = 'admin';
END; $$;

CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _type text, _title text, _message text, _link text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_notifications(user_id, type, title, message, link, payload)
  VALUES (_user_id, _type, _title, _message, _link, _payload);
END; $$;

REVOKE ALL ON FUNCTION public.notify_admins(text,text,text,text,jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_user(uuid,text,text,text,text,jsonb) FROM public, anon, authenticated;

-- Nouvelle demande -> notifie les admins + historise
CREATE OR REPLACE FUNCTION public.fqr_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status, details)
  VALUES (NEW.id, NEW.user_id, 'request_created', NEW.status,
          jsonb_build_object('origin', NEW.origin, 'destination', NEW.destination, 'departure_date', NEW.departure_date));
  PERFORM public.notify_admins(
    'flight_request_new',
    'Nouvelle demande de vol ' || NEW.request_number,
    NEW.contact_name || ' — ' || NEW.origin || ' → ' || NEW.destination,
    '/admin/vols-demandes',
    jsonb_build_object('request_id', NEW.id));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_fqr_insert AFTER INSERT ON public.flight_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.fqr_on_insert();

-- Changement de statut -> historique + notification client
CREATE OR REPLACE FUNCTION public.fqr_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text; _msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, from_status, to_status)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status);

    _title := CASE NEW.status
      WHEN 'offer_sent' THEN 'Offre disponible'
      WHEN 'accepted_pending_payment' THEN 'Offre acceptée — en attente de paiement'
      WHEN 'refused' THEN 'Offre refusée'
      WHEN 'paid' THEN 'Paiement confirmé'
      WHEN 'ticket_issued' THEN 'Billet émis'
      WHEN 'completed' THEN 'Réservation terminée'
      WHEN 'cancelled' THEN 'Réservation annulée'
      WHEN 'expired' THEN 'Offre expirée'
      ELSE 'Mise à jour de votre demande' END;
    _msg := 'Demande ' || NEW.request_number || ' — ' || NEW.origin || ' → ' || NEW.destination;
    PERFORM public.notify_user(NEW.user_id, 'flight_request_' || NEW.status, _title, _msg, '/mes-demandes-vols/' || NEW.id,
                               jsonb_build_object('request_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_fqr_status AFTER UPDATE ON public.flight_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.fqr_on_status_change();

-- Offre créée/mise à jour -> passe la demande en offer_sent
CREATE OR REPLACE FUNCTION public.fqo_on_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.flight_quote_events(request_id, actor_id, action, details)
  VALUES (NEW.request_id, auth.uid(), TG_OP = 'INSERT' AND true, jsonb_build_object('total_amount', NEW.total_amount))
  ON CONFLICT DO NOTHING;
  UPDATE public.flight_quote_requests
    SET status = 'offer_sent', updated_at = now()
    WHERE id = NEW.request_id AND status IN ('pending','offer_sent','expired','refused');
  RETURN NEW;
END; $$;

-- correction: action doit être un texte
CREATE OR REPLACE FUNCTION public.fqo_on_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.flight_quote_events(request_id, actor_id, action, details)
  VALUES (NEW.request_id, auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'offer_sent' ELSE 'offer_updated' END,
          jsonb_build_object('total_amount', NEW.total_amount, 'valid_until', NEW.valid_until));
  UPDATE public.flight_quote_requests
    SET status = 'offer_sent', updated_at = now()
    WHERE id = NEW.request_id AND status IN ('pending','offer_sent','expired','refused');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fqo_write AFTER INSERT OR UPDATE ON public.flight_quote_offers
  FOR EACH ROW EXECUTE FUNCTION public.fqo_on_write();

-- ---------------------------------------------------------
-- Réponse du client à l'offre
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_flight_offer(_request_id uuid, _accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _r public.flight_quote_requests;
  _o public.flight_quote_offers;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO _r FROM public.flight_quote_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _r.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _r.status <> 'offer_sent' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  SELECT * INTO _o FROM public.flight_quote_offers WHERE request_id = _request_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'NO_OFFER'; END IF;

  IF _o.valid_until < now() THEN
    UPDATE public.flight_quote_requests SET status = 'expired', updated_at = now() WHERE id = _request_id;
    RETURN 'expired';
  END IF;

  IF _accept THEN
    UPDATE public.flight_quote_requests SET status = 'accepted_pending_payment', updated_at = now() WHERE id = _request_id;
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status)
    VALUES (_request_id, _uid, 'offer_accepted', 'accepted_pending_payment');
    PERFORM public.notify_admins('flight_offer_accepted', 'Offre acceptée — ' || _r.request_number,
      'Le client a accepté l''offre.', '/admin/vols-demandes', jsonb_build_object('request_id', _request_id));
    RETURN 'accepted_pending_payment';
  ELSE
    UPDATE public.flight_quote_requests SET status = 'refused', updated_at = now() WHERE id = _request_id;
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status)
    VALUES (_request_id, _uid, 'offer_refused', 'refused');
    PERFORM public.notify_admins('flight_offer_refused', 'Offre refusée — ' || _r.request_number,
      'Le client a refusé l''offre, la réservation est annulée.', '/admin/vols-demandes',
      jsonb_build_object('request_id', _request_id));
    RETURN 'refused';
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.respond_flight_offer(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_flight_offer(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------
-- Paiement via portefeuille
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_flight_quote_with_wallet(_request_id uuid)
RETURNS TABLE(new_balance integer, total_paid integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _r public.flight_quote_requests;
  _o public.flight_quote_offers;
  _amount integer; _bal integer; _new integer; _ref text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO _r FROM public.flight_quote_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _r.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _r.status = 'paid' OR _r.status = 'ticket_issued' OR _r.status = 'completed' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF _r.status <> 'accepted_pending_payment' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  SELECT * INTO _o FROM public.flight_quote_offers WHERE request_id = _request_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'NO_OFFER'; END IF;
  IF _o.valid_until < now() THEN
    UPDATE public.flight_quote_requests SET status = 'expired', updated_at = now() WHERE id = _request_id;
    RAISE EXCEPTION 'OFFER_EXPIRED';
  END IF;

  _amount := GREATEST(COALESCE(_o.total_amount, 0), 0);
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _amount THEN
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, details)
    VALUES (_request_id, _uid, 'payment_failed', jsonb_build_object('reason', 'INSUFFICIENT_POINTS', 'amount', _amount));
    PERFORM public.notify_user(_uid, 'flight_payment_failed', 'Paiement refusé',
      'Solde insuffisant pour la demande ' || _r.request_number, '/mes-demandes-vols/' || _request_id, '{}'::jsonb);
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  _new := _bal - _amount;
  _ref := 'FLYQ-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  UPDATE public.vtc_wallets
    SET balance_points = _new, total_spent = total_spent + _amount, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_amount, _new, _ref, 'flight_quote_request', _request_id,
            'Paiement vol ' || COALESCE(_r.request_number, ''));

  UPDATE public.flight_quote_requests
    SET status = 'paid', paid_at = now(), updated_at = now()
    WHERE id = _request_id;

  INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status, details)
  VALUES (_request_id, _uid, 'payment_success', 'paid', jsonb_build_object('amount', _amount, 'reference', _ref));

  PERFORM public.notify_admins('flight_payment_success', 'Paiement reçu — ' || _r.request_number,
    'Montant: ' || _amount || ' FCFA', '/admin/vols-demandes', jsonb_build_object('request_id', _request_id));

  RETURN QUERY SELECT _new, _amount;
END; $$;

REVOKE ALL ON FUNCTION public.pay_flight_quote_with_wallet(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pay_flight_quote_with_wallet(uuid) TO authenticated;

-- Expiration automatique des offres dépassées
CREATE OR REPLACE FUNCTION public.expire_flight_offers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  WITH upd AS (
    UPDATE public.flight_quote_requests r
      SET status = 'expired', updated_at = now()
      FROM public.flight_quote_offers o
      WHERE o.request_id = r.id AND r.status IN ('offer_sent','accepted_pending_payment') AND o.valid_until < now()
      RETURNING r.id
  ) SELECT count(*) INTO _n FROM upd;
  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.expire_flight_offers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expire_flight_offers() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flight_quote_requests;