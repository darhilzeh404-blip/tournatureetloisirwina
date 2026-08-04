
-- ============ 1. Options agence ============
ALTER TABLE public.partner_agencies
  ADD COLUMN IF NOT EXISTS accepts_parcel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_funeral boolean NOT NULL DEFAULT false;

-- ============ 2. Voyages bus ============
CREATE TABLE IF NOT EXISTS public.bus_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  origin text NOT NULL,
  destination text NOT NULL,
  departure_date date NOT NULL,
  seats_total integer NOT NULL DEFAULT 0,
  seats_available integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  price_adult integer NOT NULL DEFAULT 0,
  price_child_7_11 integer NOT NULL DEFAULT 0,
  price_child_0_6 integer NOT NULL DEFAULT 0,
  baggage_included_kg integer NOT NULL DEFAULT 20,
  baggage_extra_price_per_kg integer NOT NULL DEFAULT 0,
  baggage_conditions text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_trips_status_check CHECK (status IN ('available','full','cancelled')),
  CONSTRAINT bus_trips_seats_check CHECK (seats_available >= 0 AND seats_available <= seats_total)
);
GRANT SELECT ON public.bus_trips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_trips TO authenticated;
GRANT ALL ON public.bus_trips TO service_role;
ALTER TABLE public.bus_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_trips_public_read" ON public.bus_trips
  FOR SELECT TO anon, authenticated USING (status <> 'cancelled');
CREATE POLICY "bus_trips_admin_all" ON public.bus_trips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS bus_trips_agency_date_idx ON public.bus_trips(agency_id, departure_date);

-- ============ 3. Réservations bus ============
CREATE TABLE IF NOT EXISTS public.bus_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.bus_trips(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  reference_code text NOT NULL UNIQUE,
  booker_name text NOT NULL,
  booker_phone text NOT NULL,
  id_document_url text NOT NULL,
  passengers_count integer NOT NULL DEFAULT 1,
  tickets_total integer NOT NULL DEFAULT 0,
  baggage_total integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reservation_id uuid,
  admin_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_bookings_status_check CHECK (status IN ('pending','paid','ticket_sent','cancelled'))
);
GRANT SELECT, UPDATE ON public.bus_bookings TO authenticated;
GRANT ALL ON public.bus_bookings TO service_role;
ALTER TABLE public.bus_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_bookings_owner_read" ON public.bus_bookings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "bus_bookings_admin_write" ON public.bus_bookings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.bus_booking_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bus_bookings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  age integer NOT NULL,
  baggage_kg integer NOT NULL DEFAULT 0,
  fare_category text NOT NULL,
  fare_amount integer NOT NULL DEFAULT 0,
  extra_kg integer NOT NULL DEFAULT 0,
  baggage_fee integer NOT NULL DEFAULT 0,
  seat_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bus_booking_passengers TO authenticated;
GRANT ALL ON public.bus_booking_passengers TO service_role;
ALTER TABLE public.bus_booking_passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_passengers_owner_read" ON public.bus_booking_passengers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.bus_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

-- ============ 4. Billet définitif ============
CREATE TABLE IF NOT EXISTS public.bus_final_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bus_bookings(id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  departure_time text NOT NULL,
  boarding_time text NOT NULL DEFAULT '',
  seat_numbers text NOT NULL DEFAULT '',
  extra_info text NOT NULL DEFAULT '',
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bus_final_tickets TO authenticated;
GRANT ALL ON public.bus_final_tickets TO service_role;
ALTER TABLE public.bus_final_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_final_tickets_owner_read" ON public.bus_final_tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.bus_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );
CREATE POLICY "bus_final_tickets_admin_all" ON public.bus_final_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ 5. Demandes de devis colis ============
CREATE TABLE IF NOT EXISTS public.bus_parcel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  reference_code text NOT NULL UNIQUE DEFAULT ('COL-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8))),
  origin text NOT NULL,
  destination text NOT NULL,
  sender_name text NOT NULL,
  sender_phone text NOT NULL,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  parcel_nature text NOT NULL,
  description text NOT NULL DEFAULT '',
  weight_kg numeric NOT NULL DEFAULT 0,
  dimensions text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  quote_price integer,
  quote_delay text,
  quote_comment text,
  quoted_at timestamptz,
  reservation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_parcel_status_check CHECK (status IN ('pending','quoted','accepted','refused','paid','cancelled'))
);
GRANT SELECT, INSERT, UPDATE ON public.bus_parcel_requests TO authenticated;
GRANT ALL ON public.bus_parcel_requests TO service_role;
ALTER TABLE public.bus_parcel_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcel_owner_read" ON public.bus_parcel_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "parcel_owner_insert" ON public.bus_parcel_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "parcel_admin_update" ON public.bus_parcel_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ 6. Demandes transport funéraire ============
CREATE TABLE IF NOT EXISTS public.bus_funeral_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  reference_code text NOT NULL UNIQUE DEFAULT ('FUN-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8))),
  origin text NOT NULL,
  destination text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  deceased_name text NOT NULL,
  transport_type text NOT NULL,
  documents text NOT NULL DEFAULT '',
  comments text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  quote_price integer,
  quote_conditions text,
  quote_available_date date,
  quoted_at timestamptz,
  reservation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_funeral_status_check CHECK (status IN ('pending','quoted','accepted','refused','paid','cancelled'))
);
GRANT SELECT, INSERT, UPDATE ON public.bus_funeral_requests TO authenticated;
GRANT ALL ON public.bus_funeral_requests TO service_role;
ALTER TABLE public.bus_funeral_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funeral_owner_read" ON public.bus_funeral_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "funeral_owner_insert" ON public.bus_funeral_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "funeral_admin_update" ON public.bus_funeral_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ 7. updated_at ============
CREATE TRIGGER trg_bus_trips_updated BEFORE UPDATE ON public.bus_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bus_bookings_updated BEFORE UPDATE ON public.bus_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bus_final_tickets_updated BEFORE UPDATE ON public.bus_final_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bus_parcel_updated BEFORE UPDATE ON public.bus_parcel_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bus_funeral_updated BEFORE UPDATE ON public.bus_funeral_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 8. Création de réservation bus (calcul serveur) ============
CREATE OR REPLACE FUNCTION public.create_bus_booking(
  _trip_id uuid,
  _booker_name text,
  _booker_phone text,
  _id_document_url text,
  _passengers jsonb
)
RETURNS TABLE(booking_id uuid, reservation_id uuid, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _trip public.bus_trips;
  _agency_name text;
  _p jsonb;
  _age int;
  _kg int;
  _fare int;
  _cat text;
  _extra int;
  _bfee int;
  _tickets int := 0;
  _baggage int := 0;
  _count int := 0;
  _bid uuid;
  _rid uuid;
  _ref text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _id_document_url IS NULL OR btrim(_id_document_url) = '' THEN RAISE EXCEPTION 'ID_DOCUMENT_REQUIRED'; END IF;
  IF btrim(coalesce(_booker_name,'')) = '' OR btrim(coalesce(_booker_phone,'')) = '' THEN
    RAISE EXCEPTION 'BOOKER_INFO_REQUIRED';
  END IF;

  SELECT * INTO _trip FROM public.bus_trips WHERE id = _trip_id FOR UPDATE;
  IF _trip.id IS NULL THEN RAISE EXCEPTION 'TRIP_NOT_FOUND'; END IF;
  IF _trip.status <> 'available' THEN RAISE EXCEPTION 'TRIP_NOT_AVAILABLE'; END IF;

  _count := jsonb_array_length(coalesce(_passengers, '[]'::jsonb));
  IF _count < 1 THEN RAISE EXCEPTION 'PASSENGERS_REQUIRED'; END IF;
  IF _count > _trip.seats_available THEN RAISE EXCEPTION 'NOT_ENOUGH_SEATS'; END IF;

  _ref := 'BUS-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  INSERT INTO public.bus_bookings(trip_id, user_id, reference_code, booker_name, booker_phone,
    id_document_url, passengers_count, tickets_total, baggage_total, total_amount, status)
  VALUES (_trip_id, _uid, _ref, btrim(_booker_name), btrim(_booker_phone),
    _id_document_url, _count, 0, 0, 0, 'pending')
  RETURNING id INTO _bid;

  FOR _p IN SELECT * FROM jsonb_array_elements(_passengers) LOOP
    _age := GREATEST(coalesce((_p->>'age')::int, 0), 0);
    _kg := GREATEST(coalesce((_p->>'baggage_kg')::int, 0), 0);
    IF _age >= 12 THEN
      _fare := _trip.price_adult; _cat := 'adult';
    ELSIF _age >= 7 THEN
      _fare := _trip.price_child_7_11; _cat := 'child_7_11';
    ELSE
      _fare := _trip.price_child_0_6; _cat := 'child_0_6';
    END IF;
    _extra := GREATEST(_kg - _trip.baggage_included_kg, 0);
    _bfee := _extra * _trip.baggage_extra_price_per_kg;

    INSERT INTO public.bus_booking_passengers(booking_id, full_name, age, baggage_kg,
      fare_category, fare_amount, extra_kg, baggage_fee)
    VALUES (_bid, coalesce(btrim(_p->>'full_name'), ''), _age, _kg, _cat, _fare, _extra, _bfee);

    _tickets := _tickets + _fare;
    _baggage := _baggage + _bfee;
  END LOOP;

  IF (_tickets + _baggage) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  UPDATE public.bus_bookings
    SET tickets_total = _tickets, baggage_total = _baggage, total_amount = _tickets + _baggage
    WHERE id = _bid;

  SELECT name INTO _agency_name FROM public.partner_agencies WHERE id = _trip.agency_id;

  INSERT INTO public.reservations(user_id, service_type, reservation_date, total_amount, paid_amount, details)
  VALUES (_uid, 'BILLET'::service_type, _trip.departure_date, _tickets + _baggage, 0,
    jsonb_build_object(
      'bus_booking_id', _bid,
      'reference_code', _ref,
      'title', 'Billet bus ' || _trip.origin || ' -> ' || _trip.destination,
      'agency', _agency_name,
      'agency_id', _trip.agency_id,
      'origin', _trip.origin,
      'destination', _trip.destination,
      'departure_date', _trip.departure_date,
      'passengers', _count,
      'tickets_total', _tickets,
      'baggage_total', _baggage,
      'passenger_name', btrim(_booker_name),
      'passenger_phone', btrim(_booker_phone)
    ))
  RETURNING id INTO _rid;

  UPDATE public.bus_bookings SET reservation_id = _rid WHERE id = _bid;

  PERFORM public.notify_admins('bus_booking', 'Nouvelle réservation bus',
    _ref || ' - ' || _trip.origin || ' -> ' || _trip.destination,
    '/admin/bus-billetterie', jsonb_build_object('booking_id', _bid));

  RETURN QUERY SELECT _bid, _rid, (_tickets + _baggage);
END;
$$;
REVOKE ALL ON FUNCTION public.create_bus_booking(uuid, text, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_bus_booking(uuid, text, text, text, jsonb) TO authenticated;

-- ============ 9. Validation du montant des réservations bus/devis ============
CREATE OR REPLACE FUNCTION public.validate_bus_reservation_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expected integer;
  _bid uuid;
BEGIN
  _bid := NULLIF(NEW.details->>'bus_booking_id','')::uuid;
  IF _bid IS NOT NULL THEN
    SELECT total_amount INTO _expected FROM public.bus_bookings WHERE id = _bid AND user_id = NEW.user_id;
    IF _expected IS NULL OR NEW.total_amount <> _expected THEN
      RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_BUS';
    END IF;
  END IF;

  _bid := NULLIF(NEW.details->>'parcel_request_id','')::uuid;
  IF _bid IS NOT NULL THEN
    SELECT quote_price INTO _expected FROM public.bus_parcel_requests
      WHERE id = _bid AND user_id = NEW.user_id AND status IN ('quoted','accepted');
    IF _expected IS NULL OR NEW.total_amount <> _expected THEN
      RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_PARCEL';
    END IF;
  END IF;

  _bid := NULLIF(NEW.details->>'funeral_request_id','')::uuid;
  IF _bid IS NOT NULL THEN
    SELECT quote_price INTO _expected FROM public.bus_funeral_requests
      WHERE id = _bid AND user_id = NEW.user_id AND status IN ('quoted','accepted');
    IF _expected IS NULL OR NEW.total_amount <> _expected THEN
      RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_FUNERAL';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_bus_reservation_amount
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.validate_bus_reservation_amount();

-- ============ 10. Gestion des places au paiement ============
CREATE OR REPLACE FUNCTION public.sync_bus_booking_on_reservation_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bid uuid;
  _pid uuid;
  _fid uuid;
  _seats int;
  _trip uuid;
BEGIN
  IF NEW.paiement_valide IS TRUE AND COALESCE(OLD.paiement_valide, false) IS FALSE THEN
    _bid := NULLIF(NEW.details->>'bus_booking_id','')::uuid;
    IF _bid IS NOT NULL THEN
      UPDATE public.bus_bookings SET status = 'paid'
        WHERE id = _bid AND status = 'pending'
        RETURNING trip_id, passengers_count INTO _trip, _seats;
      IF _trip IS NOT NULL THEN
        UPDATE public.bus_trips
          SET seats_available = GREATEST(seats_available - _seats, 0),
              status = CASE WHEN GREATEST(seats_available - _seats, 0) = 0 THEN 'full' ELSE status END
          WHERE id = _trip;
        PERFORM public.notify_admins('bus_booking_paid', 'Réservation bus payée',
          'Une réservation bus vient d''être payée.', '/admin/bus-billetterie',
          jsonb_build_object('booking_id', _bid));
      END IF;
    END IF;

    _pid := NULLIF(NEW.details->>'parcel_request_id','')::uuid;
    IF _pid IS NOT NULL THEN
      UPDATE public.bus_parcel_requests SET status = 'paid', reservation_id = NEW.id WHERE id = _pid;
    END IF;

    _fid := NULLIF(NEW.details->>'funeral_request_id','')::uuid;
    IF _fid IS NOT NULL THEN
      UPDATE public.bus_funeral_requests SET status = 'paid', reservation_id = NEW.id WHERE id = _fid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sync_bus_booking_paid
  AFTER UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_bus_booking_on_reservation_paid();

-- Restitution des places à l'annulation
CREATE OR REPLACE FUNCTION public.bus_booking_release_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('paid','ticket_sent') THEN
    UPDATE public.bus_trips
      SET seats_available = LEAST(seats_available + NEW.passengers_count, seats_total),
          status = CASE WHEN status = 'full' THEN 'available' ELSE status END
      WHERE id = NEW.trip_id;
    PERFORM public.notify_user(NEW.user_id, 'bus_booking', 'Réservation bus annulée',
      'Votre réservation ' || NEW.reference_code || ' a été annulée.', '/mes-reservations', '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bus_booking_release_seats
  AFTER UPDATE ON public.bus_bookings
  FOR EACH ROW EXECUTE FUNCTION public.bus_booking_release_seats();

-- Notification à l'émission du billet définitif
CREATE OR REPLACE FUNCTION public.bus_final_ticket_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _ref text;
BEGIN
  SELECT user_id, reference_code INTO _uid, _ref FROM public.bus_bookings WHERE id = NEW.booking_id;
  UPDATE public.bus_bookings SET status = 'ticket_sent' WHERE id = NEW.booking_id AND status <> 'cancelled';
  PERFORM public.notify_user(_uid, 'bus_ticket', 'Votre billet de bus est disponible',
    'Billet N° ' || NEW.ticket_number || ' - réservation ' || coalesce(_ref, ''), '/mes-reservations',
    jsonb_build_object('booking_id', NEW.booking_id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bus_final_ticket_notify
  AFTER INSERT ON public.bus_final_tickets
  FOR EACH ROW EXECUTE FUNCTION public.bus_final_ticket_notify();

-- ============ 11. Devis : notifications + réponse client ============
CREATE OR REPLACE FUNCTION public.bus_quote_request_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins('bus_quote', 'Nouvelle demande de devis',
      NEW.reference_code || ' - ' || NEW.origin || ' -> ' || NEW.destination,
      '/admin/bus-billetterie', jsonb_build_object('request_id', NEW.id, 'table', TG_TABLE_NAME));
  ELSIF NEW.status = 'quoted' AND OLD.status IS DISTINCT FROM 'quoted' THEN
    PERFORM public.notify_user(NEW.user_id, 'bus_quote', 'Votre devis est disponible',
      'Devis ' || NEW.reference_code || ' : ' || coalesce(NEW.quote_price, 0)::text || ' FCFA',
      CASE WHEN TG_TABLE_NAME = 'bus_parcel_requests' THEN '/colis' ELSE '/transport-funeraire' END,
      jsonb_build_object('request_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_parcel_notify AFTER INSERT OR UPDATE ON public.bus_parcel_requests
  FOR EACH ROW EXECUTE FUNCTION public.bus_quote_request_notify();
CREATE TRIGGER trg_funeral_notify AFTER INSERT OR UPDATE ON public.bus_funeral_requests
  FOR EACH ROW EXECUTE FUNCTION public.bus_quote_request_notify();

CREATE OR REPLACE FUNCTION public.respond_bus_quote(_kind text, _request_id uuid, _accept boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _price integer;
  _ref text;
  _origin text;
  _dest text;
  _agency uuid;
  _agency_name text;
  _status text;
  _rid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _kind NOT IN ('parcel','funeral') THEN RAISE EXCEPTION 'INVALID_KIND'; END IF;

  IF _kind = 'parcel' THEN
    SELECT quote_price, reference_code, origin, destination, agency_id, status
      INTO _price, _ref, _origin, _dest, _agency, _status
      FROM public.bus_parcel_requests WHERE id = _request_id AND user_id = _uid FOR UPDATE;
  ELSE
    SELECT quote_price, reference_code, origin, destination, agency_id, status
      INTO _price, _ref, _origin, _dest, _agency, _status
      FROM public.bus_funeral_requests WHERE id = _request_id AND user_id = _uid FOR UPDATE;
  END IF;

  IF _ref IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _status <> 'quoted' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  IF NOT _accept THEN
    IF _kind = 'parcel' THEN
      UPDATE public.bus_parcel_requests SET status = 'refused' WHERE id = _request_id;
    ELSE
      UPDATE public.bus_funeral_requests SET status = 'refused' WHERE id = _request_id;
    END IF;
    RETURN NULL;
  END IF;

  IF coalesce(_price, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  SELECT name INTO _agency_name FROM public.partner_agencies WHERE id = _agency;

  INSERT INTO public.reservations(user_id, service_type, reservation_date, total_amount, paid_amount, details)
  VALUES (_uid, 'BILLET'::service_type, current_date, _price, 0,
    jsonb_build_object(
      CASE WHEN _kind = 'parcel' THEN 'parcel_request_id' ELSE 'funeral_request_id' END, _request_id,
      'reference_code', _ref,
      'title', CASE WHEN _kind = 'parcel' THEN 'Expédition de colis' ELSE 'Transport funéraire' END,
      'agency', _agency_name,
      'agency_id', _agency,
      'origin', _origin,
      'destination', _dest
    ))
  RETURNING id INTO _rid;

  IF _kind = 'parcel' THEN
    UPDATE public.bus_parcel_requests SET status = 'accepted', reservation_id = _rid WHERE id = _request_id;
  ELSE
    UPDATE public.bus_funeral_requests SET status = 'accepted', reservation_id = _rid WHERE id = _request_id;
  END IF;

  RETURN _rid;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_bus_quote(text, uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_bus_quote(text, uuid, boolean) TO authenticated;

-- ============ 12. Pièces d'identité (bucket bus-documents) ============
CREATE POLICY "bus_docs_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bus-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "bus_docs_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bus-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "bus_docs_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bus-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
