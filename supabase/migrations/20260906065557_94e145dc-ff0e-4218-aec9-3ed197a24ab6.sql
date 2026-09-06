-- 1) Suppression de l'ancien catalogue de programmes de vols
ALTER TABLE public.flight_quote_requests DROP COLUMN IF EXISTS program_id;
DROP TABLE IF EXISTS public.flight_programs CASCADE;
DO $$ BEGIN
  DROP TYPE IF EXISTS public.flight_program_status;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) Demandes : nouveaux champs
ALTER TABLE public.flight_quote_requests
  ADD COLUMN IF NOT EXISTS travel_class text NOT NULL DEFAULT 'economy',
  ADD COLUMN IF NOT EXISTS passengers_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS refusal_reason text,
  ADD COLUMN IF NOT EXISTS taken_by uuid,
  ADD COLUMN IF NOT EXISTS taken_at timestamptz;

UPDATE public.flight_quote_requests
  SET passengers_count = GREATEST(1, COALESCE(adults,0) + COALESCE(children,0) + COALESCE(infants,0))
  WHERE passengers_count IS NULL OR passengers_count < 1;

-- 3) Propositions : tarification détaillée + brouillon/envoi
ALTER TABLE public.flight_quote_offers
  ADD COLUMN IF NOT EXISTS price_per_person integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passengers_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fees integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fare_type text,
  ADD COLUMN IF NOT EXISTS departure_airport text,
  ADD COLUMN IF NOT EXISTS departure_city text,
  ADD COLUMN IF NOT EXISTS arrival_airport text,
  ADD COLUMN IF NOT EXISTS arrival_city text,
  ADD COLUMN IF NOT EXISTS is_direct boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

UPDATE public.flight_quote_offers SET is_sent = true, sent_at = COALESCE(sent_at, created_at) WHERE is_sent = false;

-- 4) Segments de vol
CREATE TABLE IF NOT EXISTS public.flight_offer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.flight_quote_offers(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  airline_name text,
  flight_number text,
  departure_airport text,
  departure_city text,
  departure_date date,
  departure_time text,
  arrival_airport text,
  arrival_city text,
  arrival_date date,
  arrival_time text,
  duration text,
  stopover_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_offer_segments TO authenticated;
GRANT ALL ON public.flight_offer_segments TO service_role;
ALTER TABLE public.flight_offer_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments_owner_read" ON public.flight_offer_segments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.flight_quote_offers o
  JOIN public.flight_quote_requests r ON r.id = o.request_id
  WHERE o.id = offer_id AND r.user_id = auth.uid() AND o.is_sent = true));
CREATE POLICY "segments_admin_all" ON public.flight_offer_segments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) Demandes d'informations complémentaires
CREATE TABLE IF NOT EXISTS public.flight_info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.flight_quote_requests(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Informations complémentaires',
  message text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  answered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_info_requests TO authenticated;
GRANT ALL ON public.flight_info_requests TO service_role;
ALTER TABLE public.flight_info_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "info_owner_read" ON public.flight_info_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "info_owner_answer" ON public.flight_info_requests FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "info_admin_all" ON public.flight_info_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.flight_info_client_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  NEW.request_id := OLD.request_id;
  NEW.title := OLD.title;
  NEW.message := OLD.message;
  NEW.fields := OLD.fields;
  NEW.due_date := OLD.due_date;
  NEW.created_by := OLD.created_by;
  NEW.status := CASE WHEN NEW.answers IS NOT NULL THEN 'answered' ELSE OLD.status END;
  NEW.answered_at := CASE WHEN NEW.answers IS NOT NULL THEN now() ELSE OLD.answered_at END;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_flight_info_client_guard ON public.flight_info_requests;
CREATE TRIGGER trg_flight_info_client_guard BEFORE UPDATE ON public.flight_info_requests
FOR EACH ROW EXECUTE FUNCTION public.flight_info_client_guard();

-- 6) Demandes de documents / téléversements
CREATE TABLE IF NOT EXISTS public.flight_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.flight_quote_requests(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'other',
  name text NOT NULL,
  instructions text,
  is_required boolean NOT NULL DEFAULT true,
  due_date date,
  status text NOT NULL DEFAULT 'to_provide',
  file_path text,
  file_name text,
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  review_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_document_requests TO authenticated;
GRANT ALL ON public.flight_document_requests TO service_role;
ALTER TABLE public.flight_document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_owner_read" ON public.flight_document_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "docs_owner_upload" ON public.flight_document_requests FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.flight_quote_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "docs_admin_all" ON public.flight_document_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.flight_doc_client_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','to_replace') THEN
      NEW.reviewed_at := now();
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  NEW.request_id := OLD.request_id;
  NEW.doc_type := OLD.doc_type;
  NEW.name := OLD.name;
  NEW.instructions := OLD.instructions;
  NEW.is_required := OLD.is_required;
  NEW.due_date := OLD.due_date;
  NEW.review_reason := OLD.review_reason;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.created_by := OLD.created_by;
  IF NEW.file_path IS DISTINCT FROM OLD.file_path AND NEW.file_path IS NOT NULL THEN
    NEW.status := 'uploaded';
    NEW.uploaded_at := now();
  ELSE
    NEW.status := OLD.status;
    NEW.uploaded_at := OLD.uploaded_at;
    NEW.file_path := OLD.file_path;
    NEW.file_name := OLD.file_name;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_flight_doc_client_guard ON public.flight_document_requests;
CREATE TRIGGER trg_flight_doc_client_guard BEFORE UPDATE ON public.flight_document_requests
FOR EACH ROW EXECUTE FUNCTION public.flight_doc_client_guard();

-- 7) Notifications sur informations / documents
CREATE OR REPLACE FUNCTION public.flight_info_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.flight_quote_requests;
BEGIN
  SELECT * INTO _r FROM public.flight_quote_requests WHERE id = NEW.request_id;
  IF TG_OP = 'INSERT' THEN
    UPDATE public.flight_quote_requests SET status = 'info_requested', updated_at = now()
      WHERE id = NEW.request_id AND status IN ('paid','documents_requested','processing','info_requested');
    PERFORM public.notify_user(_r.user_id, 'flight_info_requested', 'Informations complémentaires requises',
      'Des informations sont nécessaires pour finaliser votre dossier ' || COALESCE(_r.request_number,''),
      '/mes-demandes-vols/' || NEW.request_id, '{}'::jsonb);
  ELSIF NEW.answers IS NOT NULL AND OLD.answers IS NULL THEN
    PERFORM public.notify_admins('flight_info_answered', 'Informations reçues — ' || COALESCE(_r.request_number,''),
      'Le client a complété les informations demandées.', '/admin/vols-demandes',
      jsonb_build_object('request_id', NEW.request_id));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_flight_info_notify ON public.flight_info_requests;
CREATE TRIGGER trg_flight_info_notify AFTER INSERT OR UPDATE ON public.flight_info_requests
FOR EACH ROW EXECUTE FUNCTION public.flight_info_notify();

CREATE OR REPLACE FUNCTION public.flight_doc_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.flight_quote_requests;
BEGIN
  SELECT * INTO _r FROM public.flight_quote_requests WHERE id = NEW.request_id;
  IF TG_OP = 'INSERT' THEN
    UPDATE public.flight_quote_requests SET status = 'documents_requested', updated_at = now()
      WHERE id = NEW.request_id AND status IN ('paid','info_requested','processing','documents_requested');
    PERFORM public.notify_user(_r.user_id, 'flight_documents_requested', 'Documents requis',
      'Un document est nécessaire pour finaliser votre réservation : ' || NEW.name,
      '/mes-demandes-vols/' || NEW.request_id, '{}'::jsonb);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'uploaded' THEN
      PERFORM public.notify_admins('flight_document_uploaded', 'Document reçu — ' || COALESCE(_r.request_number,''),
        NEW.name, '/admin/vols-demandes', jsonb_build_object('request_id', NEW.request_id));
    ELSIF NEW.status IN ('rejected','to_replace') THEN
      PERFORM public.notify_user(_r.user_id, 'flight_document_rejected', 'Document à remplacer',
        COALESCE(NEW.review_reason, 'Merci de téléverser une nouvelle copie de : ' || NEW.name),
        '/mes-demandes-vols/' || NEW.request_id, '{}'::jsonb);
    ELSIF NEW.status = 'approved' THEN
      PERFORM public.notify_user(_r.user_id, 'flight_document_approved', 'Document validé',
        NEW.name || ' a été validé.', '/mes-demandes-vols/' || NEW.request_id, '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_flight_doc_notify ON public.flight_document_requests;
CREATE TRIGGER trg_flight_doc_notify AFTER INSERT OR UPDATE ON public.flight_document_requests
FOR EACH ROW EXECUTE FUNCTION public.flight_doc_notify();

-- 8) Proposition : n'est visible qu'une fois envoyée
CREATE OR REPLACE FUNCTION public.fqo_on_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.total_amount := GREATEST(0,
    COALESCE(NEW.price_per_person,0) * GREATEST(COALESCE(NEW.passengers_count,1),1)
    + COALESCE(NEW.fees,0) + COALESCE(NEW.taxes,0) + COALESCE(NEW.service_fee,0)
    - COALESCE(NEW.discount,0));

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
DROP TRIGGER IF EXISTS fqo_on_write ON public.flight_quote_offers;
DROP TRIGGER IF EXISTS trg_fqo_on_write ON public.flight_quote_offers;
CREATE TRIGGER trg_fqo_on_write BEFORE INSERT OR UPDATE ON public.flight_quote_offers
FOR EACH ROW EXECUTE FUNCTION public.fqo_on_write();

-- 9) Libellés de statuts étendus
CREATE OR REPLACE FUNCTION public.fqr_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text; _msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, from_status, to_status)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status);

    _title := CASE NEW.status
      WHEN 'in_progress' THEN 'Votre demande est en cours de traitement'
      WHEN 'offer_sent' THEN 'Proposition de billet disponible'
      WHEN 'accepted_pending_payment' THEN 'Proposition acceptée — paiement en attente'
      WHEN 'refused' THEN 'Proposition refusée'
      WHEN 'paid' THEN 'Paiement confirmé'
      WHEN 'info_requested' THEN 'Informations complémentaires requises'
      WHEN 'documents_requested' THEN 'Documents requis'
      WHEN 'processing' THEN 'Dossier en traitement'
      WHEN 'confirmed' THEN 'Billet confirmé'
      WHEN 'ticket_issued' THEN 'Billet émis'
      WHEN 'completed' THEN 'Dossier terminé'
      WHEN 'cancelled' THEN 'Demande annulée'
      WHEN 'expired' THEN 'Proposition expirée'
      ELSE 'Mise à jour de votre demande' END;
    _msg := 'Demande ' || NEW.request_number || ' — ' || NEW.origin || ' → ' || NEW.destination;
    PERFORM public.notify_user(NEW.user_id, 'flight_request_' || NEW.status, _title, _msg,
      '/mes-demandes-vols/' || NEW.id, jsonb_build_object('request_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

-- 10) Prise en charge + confirmation par l'administrateur
CREATE OR REPLACE FUNCTION public.admin_take_flight_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.flight_quote_requests
    SET status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
        taken_by = auth.uid(), taken_at = now(), updated_at = now()
    WHERE id = _request_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_take_flight_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_take_flight_request(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_flight_request_status(_request_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _status NOT IN ('pending','in_progress','offer_sent','accepted_pending_payment','refused','paid',
                     'info_requested','documents_requested','processing','confirmed','completed','cancelled','expired')
  THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  UPDATE public.flight_quote_requests SET status = _status, updated_at = now() WHERE id = _request_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_flight_request_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_flight_request_status(uuid, text) TO authenticated, service_role;

-- 11) Réponse client avec motif de refus
DROP FUNCTION IF EXISTS public.respond_flight_offer(uuid, boolean);
CREATE OR REPLACE FUNCTION public.respond_flight_offer(_request_id uuid, _accept boolean, _reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _r public.flight_quote_requests; _o public.flight_quote_offers;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO _r FROM public.flight_quote_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _r.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _r.status <> 'offer_sent' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  SELECT * INTO _o FROM public.flight_quote_offers WHERE request_id = _request_id AND is_sent = true;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'NO_OFFER'; END IF;
  IF _o.valid_until < now() THEN
    UPDATE public.flight_quote_requests SET status = 'expired', updated_at = now() WHERE id = _request_id;
    RETURN 'expired';
  END IF;

  IF _accept THEN
    UPDATE public.flight_quote_requests SET status = 'accepted_pending_payment', updated_at = now() WHERE id = _request_id;
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status)
    VALUES (_request_id, _uid, 'offer_accepted', 'accepted_pending_payment');
    PERFORM public.notify_admins('flight_offer_accepted', 'Proposition acceptée — ' || _r.request_number,
      'Le client a accepté la proposition.', '/admin/vols-demandes', jsonb_build_object('request_id', _request_id));
    RETURN 'accepted_pending_payment';
  ELSE
    UPDATE public.flight_quote_requests SET status = 'refused', refusal_reason = NULLIF(btrim(COALESCE(_reason,'')),''), updated_at = now()
      WHERE id = _request_id;
    INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status, details)
    VALUES (_request_id, _uid, 'offer_refused', 'refused', jsonb_build_object('reason', _reason));
    PERFORM public.notify_admins('flight_offer_refused', 'Proposition refusée — ' || _r.request_number,
      COALESCE(_reason, 'Le client a refusé la proposition.'), '/admin/vols-demandes',
      jsonb_build_object('request_id', _request_id));
    RETURN 'refused';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.respond_flight_offer(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_flight_offer(uuid, boolean, text) TO authenticated, service_role;

-- 12) Paiement : la proposition doit avoir été envoyée
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
  IF _r.status IN ('paid','info_requested','documents_requested','processing','confirmed','ticket_issued','completed') THEN
    RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF _r.status <> 'accepted_pending_payment' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  SELECT * INTO _o FROM public.flight_quote_offers WHERE request_id = _request_id AND is_sent = true;
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

  UPDATE public.vtc_wallets SET balance_points = _new, total_spent = total_spent + _amount, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_amount, _new, _ref, 'flight_quote_request', _request_id,
            'Paiement vol ' || COALESCE(_r.request_number, ''));

  UPDATE public.flight_quote_requests SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = _request_id;

  INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status, details)
  VALUES (_request_id, _uid, 'payment_success', 'paid', jsonb_build_object('amount', _amount, 'reference', _ref));

  PERFORM public.notify_admins('flight_payment_success', 'Paiement reçu — ' || _r.request_number,
    'Montant: ' || _amount || ' FCFA', '/admin/vols-demandes', jsonb_build_object('request_id', _request_id));

  RETURN QUERY SELECT _new, _amount;
END; $$;
REVOKE ALL ON FUNCTION public.pay_flight_quote_with_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_flight_quote_with_wallet(uuid) TO authenticated, service_role;

-- 13) Documents : politiques de stockage
CREATE POLICY "flight_docs_owner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'flight-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "flight_docs_owner_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'flight-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "flight_docs_owner_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'flight-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'flight-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "flight_docs_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'flight-documents' AND public.has_role(auth.uid(), 'admin'));