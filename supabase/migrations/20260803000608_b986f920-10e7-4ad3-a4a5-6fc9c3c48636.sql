
-- ============ VTC notify waitlist ============
CREATE TABLE public.vtc_relaunch_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vtc_relaunch_subscribers TO authenticated;
GRANT ALL ON public.vtc_relaunch_subscribers TO service_role;
ALTER TABLE public.vtc_relaunch_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vtc_relaunch_insert_self" ON public.vtc_relaunch_subscribers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "vtc_relaunch_select_self" ON public.vtc_relaunch_subscribers
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX vtc_relaunch_subscribers_user_key ON public.vtc_relaunch_subscribers(user_id);

-- ============ Moving requests ============
CREATE TABLE public.moving_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_code text NOT NULL UNIQUE DEFAULT ('DEM-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8))),

  full_name text NOT NULL,
  phone text NOT NULL,
  email text,

  from_address text NOT NULL,
  from_quartier text,
  from_commune text,
  from_lat double precision,
  from_lng double precision,

  to_address text NOT NULL,
  to_quartier text,
  to_commune text,
  to_lat double precision,
  to_lng double precision,

  desired_date date NOT NULL,
  desired_time time,

  housing_type text NOT NULL CHECK (housing_type IN ('CHAMBRE','STUDIO','APPARTEMENT','MAISON','VILLA','BUREAU','COMMERCE','ENTREPOT')),
  service_type text NOT NULL CHECK (service_type IN ('CAMION_SEUL','CLASSIQUE','COMPLET')),
  volume text NOT NULL CHECK (volume IN ('PETIT','MOYEN','GRAND','TRES_GRAND')),

  from_floor text NOT NULL DEFAULT 'RDC' CHECK (from_floor IN ('RDC','1','2','3','4','5+')),
  to_floor text NOT NULL DEFAULT 'RDC' CHECK (to_floor IN ('RDC','1','2','3','4','5+')),
  from_elevator boolean NOT NULL DEFAULT false,
  to_elevator boolean NOT NULL DEFAULT false,

  movers_count integer NOT NULL DEFAULT 0 CHECK (movers_count IN (0,2,4,6,8)),
  ac_dismount boolean NOT NULL DEFAULT false,
  ac_units integer NOT NULL DEFAULT 0 CHECK (ac_units >= 0),
  reassembly boolean NOT NULL DEFAULT false,
  packing text NOT NULL DEFAULT 'AUCUN' CHECK (packing IN ('AUCUN','PARTIEL','COMPLET')),
  boxes_count integer NOT NULL DEFAULT 0 CHECK (boxes_count >= 0),
  comment text,

  status text NOT NULL DEFAULT 'NOUVELLE' CHECK (status IN ('NOUVELLE','ANALYSE','DEVIS_ENVOYE','ACCEPTE','REFUSE','MODIFICATION_DEMANDEE','EN_COURS','TERMINE','ANNULE')),
  paid boolean NOT NULL DEFAULT false,
  paid_amount integer NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  paid_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.moving_requests TO authenticated;
GRANT ALL ON public.moving_requests TO service_role;
ALTER TABLE public.moving_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moving_requests_select" ON public.moving_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "moving_requests_insert_self" ON public.moving_requests
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND status = 'NOUVELLE' AND paid = false AND paid_amount = 0
  );
CREATE POLICY "moving_requests_update_admin" ON public.moving_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX moving_requests_user_idx ON public.moving_requests(user_id, created_at DESC);
CREATE INDEX moving_requests_status_idx ON public.moving_requests(status, created_at DESC);

CREATE TRIGGER trg_moving_requests_updated_at BEFORE UPDATE ON public.moving_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Items (furniture to dismount / heavy objects) ============
CREATE TABLE public.moving_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.moving_requests(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('MEUBLE','LOURD')),
  label text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.moving_request_items TO authenticated;
GRANT ALL ON public.moving_request_items TO service_role;
ALTER TABLE public.moving_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moving_items_select" ON public.moving_request_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "moving_items_insert_owner" ON public.moving_request_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "moving_items_delete_owner" ON public.moving_request_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE INDEX moving_items_request_idx ON public.moving_request_items(request_id);

-- ============ Photos ============
CREATE TABLE public.moving_request_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.moving_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.moving_request_photos TO authenticated;
GRANT ALL ON public.moving_request_photos TO service_role;
ALTER TABLE public.moving_request_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moving_photos_select" ON public.moving_request_photos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "moving_photos_insert_owner" ON public.moving_request_photos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );
CREATE POLICY "moving_photos_delete_owner" ON public.moving_request_photos
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE INDEX moving_photos_request_idx ON public.moving_request_photos(request_id);

CREATE OR REPLACE FUNCTION public.moving_photos_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.moving_request_photos WHERE request_id = NEW.request_id) >= 15 THEN
    RAISE EXCEPTION 'PHOTO_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_moving_photos_limit BEFORE INSERT ON public.moving_request_photos
  FOR EACH ROW EXECUTE FUNCTION public.moving_photos_limit();

-- ============ Quotes ============
CREATE TABLE public.moving_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.moving_requests(id) ON DELETE CASCADE,
  price integer NOT NULL CHECK (price > 0),
  details text,
  conditions text,
  scheduled_date date,
  scheduled_time time,
  admin_note text,
  status text NOT NULL DEFAULT 'ENVOYE' CHECK (status IN ('ENVOYE','ACCEPTE','REFUSE','MODIFICATION_DEMANDEE','ANNULE')),
  client_message text,
  responded_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.moving_quotes TO authenticated;
GRANT ALL ON public.moving_quotes TO service_role;
ALTER TABLE public.moving_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moving_quotes_select" ON public.moving_quotes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "moving_quotes_admin_insert" ON public.moving_quotes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "moving_quotes_admin_update" ON public.moving_quotes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX moving_quotes_request_idx ON public.moving_quotes(request_id, created_at DESC);
CREATE TRIGGER trg_moving_quotes_updated_at BEFORE UPDATE ON public.moving_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Status history ============
CREATE TABLE public.moving_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.moving_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.moving_status_history TO authenticated;
GRANT ALL ON public.moving_status_history TO service_role;
ALTER TABLE public.moving_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moving_history_select" ON public.moving_status_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.moving_requests r WHERE r.id = request_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE INDEX moving_history_request_idx ON public.moving_status_history(request_id, created_at DESC);

-- ============ Notifications + history triggers ============
CREATE OR REPLACE FUNCTION public.moving_request_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid;
BEGIN
  INSERT INTO public.moving_status_history(request_id, status, changed_by, note)
  VALUES (NEW.id, NEW.status, NEW.user_id, 'Demande créée');

  PERFORM public.notify_user(
    NEW.user_id, 'moving_request_created', 'Demande de déménagement transmise',
    'Votre demande ' || NEW.reference_code || ' a été transmise. Notre équipe vous enverra un devis personnalisé.',
    '/demenagement/' || NEW.id::text, '{}'::jsonb);

  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.notify_user(
      _admin, 'moving_request_created', 'Nouvelle demande de déménagement',
      NEW.full_name || ' — ' || NEW.reference_code,
      '/admin/demenagements', jsonb_build_object('request_id', NEW.id));
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_moving_request_on_insert AFTER INSERT ON public.moving_requests
  FOR EACH ROW EXECUTE FUNCTION public.moving_request_on_insert();

CREATE OR REPLACE FUNCTION public.moving_request_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.moving_status_history(request_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());

    IF NEW.status = 'EN_COURS' THEN
      PERFORM public.notify_user(NEW.user_id, 'moving_started', 'Déménagement commencé',
        'Votre déménagement ' || NEW.reference_code || ' a démarré.', '/demenagement/' || NEW.id::text, '{}'::jsonb);
    ELSIF NEW.status = 'TERMINE' THEN
      PERFORM public.notify_user(NEW.user_id, 'moving_completed', 'Déménagement terminé',
        'Votre déménagement ' || NEW.reference_code || ' est terminé. Merci de votre confiance !', '/demenagement/' || NEW.id::text, '{}'::jsonb);
    ELSIF NEW.status = 'ANNULE' THEN
      PERFORM public.notify_user(NEW.user_id, 'moving_cancelled', 'Déménagement annulé',
        'Votre demande ' || NEW.reference_code || ' a été annulée.', '/demenagement/' || NEW.id::text, '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_moving_request_on_status_change AFTER UPDATE ON public.moving_requests
  FOR EACH ROW EXECUTE FUNCTION public.moving_request_on_status_change();

CREATE OR REPLACE FUNCTION public.moving_quote_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.moving_requests;
BEGIN
  SELECT * INTO _r FROM public.moving_requests WHERE id = NEW.request_id;
  UPDATE public.moving_requests SET status = 'DEVIS_ENVOYE', updated_at = now() WHERE id = NEW.request_id;
  PERFORM public.notify_user(_r.user_id, 'moving_quote_sent', 'Votre devis de déménagement est prêt',
    'Devis de ' || NEW.price::text || ' FCFA pour la demande ' || _r.reference_code || '. Consultez-le pour accepter ou refuser.',
    '/demenagement/' || _r.id::text, jsonb_build_object('quote_id', NEW.id));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_moving_quote_on_insert AFTER INSERT ON public.moving_quotes
  FOR EACH ROW EXECUTE FUNCTION public.moving_quote_on_insert();

-- ============ Client response to quote ============
CREATE OR REPLACE FUNCTION public.respond_moving_quote(_quote_id uuid, _action text, _message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _q public.moving_quotes;
  _r public.moving_requests;
  _admin uuid;
  _new_status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _action NOT IN ('accept','refuse','modify') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  SELECT * INTO _q FROM public.moving_quotes WHERE id = _quote_id FOR UPDATE;
  IF _q.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO _r FROM public.moving_requests WHERE id = _q.request_id;
  IF _r.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _q.status <> 'ENVOYE' THEN RAISE EXCEPTION 'ALREADY_ANSWERED'; END IF;

  _new_status := CASE _action WHEN 'accept' THEN 'ACCEPTE' WHEN 'refuse' THEN 'REFUSE' ELSE 'MODIFICATION_DEMANDEE' END;

  UPDATE public.moving_quotes
    SET status = _new_status, client_message = _message, responded_at = now(), updated_at = now()
    WHERE id = _quote_id;
  UPDATE public.moving_requests SET status = _new_status, updated_at = now() WHERE id = _r.id;

  PERFORM public.notify_user(_uid, 'moving_quote_' || _action,
    CASE _action WHEN 'accept' THEN 'Devis accepté' WHEN 'refuse' THEN 'Devis refusé' ELSE 'Modification demandée' END,
    'Demande ' || _r.reference_code, '/demenagement/' || _r.id::text, '{}'::jsonb);

  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.notify_user(_admin, 'moving_quote_response',
      CASE _action WHEN 'accept' THEN 'Devis déménagement accepté' WHEN 'refuse' THEN 'Devis déménagement refusé' ELSE 'Modification de devis demandée' END,
      _r.full_name || ' — ' || _r.reference_code, '/admin/demenagements', jsonb_build_object('request_id', _r.id));
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.respond_moving_quote(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.respond_moving_quote(uuid, text, text) TO authenticated;

-- ============ Wallet payment ============
CREATE OR REPLACE FUNCTION public.pay_moving_quote_with_wallet(_quote_id uuid)
RETURNS TABLE(new_balance integer, total_paid integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _q public.moving_quotes;
  _r public.moving_requests;
  _amount integer;
  _bal integer;
  _new integer;
  _ref text;
  _admin uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO _q FROM public.moving_quotes WHERE id = _quote_id FOR UPDATE;
  IF _q.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO _r FROM public.moving_requests WHERE id = _q.request_id FOR UPDATE;
  IF _r.user_id <> _uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _q.status <> 'ACCEPTE' THEN RAISE EXCEPTION 'QUOTE_NOT_ACCEPTED'; END IF;
  IF _r.paid THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;

  _amount := _q.price;
  IF _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  INSERT INTO public.vtc_wallets(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_points INTO _bal FROM public.vtc_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;

  _new := _bal - _amount;
  _ref := 'DEM-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  UPDATE public.vtc_wallets
    SET balance_points = _new, total_spent = total_spent + _amount, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.vtc_wallet_transactions(
    user_id, type, amount_points, balance_after, reference_code, related_type, related_id, note
  ) VALUES (_uid, 'trip_payment', -_amount, _new, _ref, 'moving_request', _r.id,
            'Paiement déménagement ' || _r.reference_code);

  UPDATE public.moving_requests
    SET paid = true, paid_amount = _amount, paid_at = now(), updated_at = now()
    WHERE id = _r.id;

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
REVOKE ALL ON FUNCTION public.pay_moving_quote_with_wallet(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pay_moving_quote_with_wallet(uuid) TO authenticated;

-- ============ Storage policies for moving photos ============
CREATE POLICY "moving_photos_upload_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'moving-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "moving_photos_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'moving-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "moving_photos_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'moving-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

ALTER PUBLICATION supabase_realtime ADD TABLE public.moving_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moving_quotes;
