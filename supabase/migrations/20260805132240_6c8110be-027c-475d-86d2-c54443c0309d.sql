-- 1. Trips: validity period + bus type
ALTER TABLE public.bus_trips
  ADD COLUMN IF NOT EXISTS date_start date,
  ADD COLUMN IF NOT EXISTS date_end date,
  ADD COLUMN IF NOT EXISTS bus_type text NOT NULL DEFAULT '';

UPDATE public.bus_trips SET date_start = COALESCE(date_start, departure_date), date_end = COALESCE(date_end, departure_date);
ALTER TABLE public.bus_trips ALTER COLUMN date_start SET NOT NULL;
ALTER TABLE public.bus_trips ALTER COLUMN date_end SET NOT NULL;
ALTER TABLE public.bus_trips ALTER COLUMN departure_date DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.bus_trips_validate_period()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.date_end < NEW.date_start THEN RAISE EXCEPTION 'INVALID_PERIOD'; END IF;
  NEW.departure_date := COALESCE(NEW.departure_date, NEW.date_start);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bus_trips_validate_period ON public.bus_trips;
CREATE TRIGGER trg_bus_trips_validate_period BEFORE INSERT OR UPDATE ON public.bus_trips
FOR EACH ROW EXECUTE FUNCTION public.bus_trips_validate_period();

-- 2. Bookings: chosen date + traveller counters + baggage
ALTER TABLE public.bus_bookings
  ADD COLUMN IF NOT EXISTS travel_date date,
  ADD COLUMN IF NOT EXISTS adults_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infants_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baggage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baggage_notes text NOT NULL DEFAULT '';

ALTER TABLE public.bus_bookings DROP CONSTRAINT IF EXISTS bus_bookings_status_check;
ALTER TABLE public.bus_bookings ADD CONSTRAINT bus_bookings_status_check
  CHECK (status = ANY (ARRAY['pending','validated','refused','paid','ticket_sent','cancelled']));

-- 3. Create a booking request (no payment, no ticket)
CREATE OR REPLACE FUNCTION public.create_bus_reservation_request(
  _trip_id uuid,
  _travel_date date,
  _adults integer,
  _children integer,
  _infants integer,
  _baggage_count integer,
  _baggage_notes text,
  _booker_name text,
  _booker_phone text,
  _id_document_url text
) RETURNS TABLE(booking_id uuid, reference_code text, total integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _trip public.bus_trips;
  _a int := GREATEST(COALESCE(_adults,0),0);
  _c int := GREATEST(COALESCE(_children,0),0);
  _i int := GREATEST(COALESCE(_infants,0),0);
  _bag int := GREATEST(COALESCE(_baggage_count,0),0);
  _count int;
  _tickets int;
  _bid uuid;
  _ref text;
  _agency_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF COALESCE(btrim(_id_document_url),'') = '' THEN RAISE EXCEPTION 'ID_DOCUMENT_REQUIRED'; END IF;
  IF COALESCE(btrim(_booker_name),'') = '' OR COALESCE(btrim(_booker_phone),'') = '' THEN
    RAISE EXCEPTION 'BOOKER_INFO_REQUIRED';
  END IF;

  SELECT * INTO _trip FROM public.bus_trips WHERE id = _trip_id FOR UPDATE;
  IF _trip.id IS NULL THEN RAISE EXCEPTION 'TRIP_NOT_FOUND'; END IF;
  IF _trip.status <> 'available' THEN RAISE EXCEPTION 'TRIP_NOT_AVAILABLE'; END IF;
  IF _travel_date IS NULL OR _travel_date < _trip.date_start OR _travel_date > _trip.date_end THEN
    RAISE EXCEPTION 'DATE_OUT_OF_RANGE';
  END IF;
  IF _travel_date < CURRENT_DATE THEN RAISE EXCEPTION 'DATE_IN_PAST'; END IF;

  _count := _a + _c + _i;
  IF _count < 1 THEN RAISE EXCEPTION 'PASSENGERS_REQUIRED'; END IF;
  IF _trip.seats_available > 0 AND _count > _trip.seats_available THEN RAISE EXCEPTION 'NOT_ENOUGH_SEATS'; END IF;

  _tickets := _a * _trip.price_adult + _c * _trip.price_child_7_11 + _i * _trip.price_child_0_6;
  IF _tickets <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  _ref := 'BUS-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 10));

  INSERT INTO public.bus_bookings(trip_id, user_id, reference_code, booker_name, booker_phone,
    id_document_url, passengers_count, adults_count, children_count, infants_count,
    baggage_count, baggage_notes, travel_date, tickets_total, baggage_total, total_amount, status)
  VALUES (_trip_id, _uid, _ref, btrim(_booker_name), btrim(_booker_phone), _id_document_url,
    _count, _a, _c, _i, _bag, COALESCE(btrim(_baggage_notes),''), _travel_date,
    _tickets, 0, _tickets, 'pending')
  RETURNING id INTO _bid;

  SELECT name INTO _agency_name FROM public.partner_agencies WHERE id = _trip.agency_id;

  PERFORM public.notify_user(_uid, 'bus_booking', 'Demande de réservation envoyée',
    'Votre demande ' || _ref || ' (' || _trip.origin || ' → ' || _trip.destination ||
    ') a été envoyée à ' || COALESCE(_agency_name,'l''agence') || '. Le billet définitif sera disponible après confirmation.',
    '/mes-reservations', '{}'::jsonb);
  PERFORM public.notify_admins('bus_booking', 'Nouvelle demande de réservation bus',
    _ref || ' · ' || _trip.origin || ' → ' || _trip.destination || ' · ' || _count || ' voyageur(s)',
    '/admin/bus-billetterie', '{}'::jsonb);

  RETURN QUERY SELECT _bid, _ref, _tickets;
END;
$$;
REVOKE ALL ON FUNCTION public.create_bus_reservation_request(uuid,date,integer,integer,integer,integer,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_bus_reservation_request(uuid,date,integer,integer,integer,integer,text,text,text,text) TO authenticated;

-- 4. Admin decision
CREATE OR REPLACE FUNCTION public.admin_decide_bus_booking(_booking_id uuid, _approve boolean, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b public.bus_bookings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO _b FROM public.bus_bookings WHERE id = _booking_id FOR UPDATE;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF _b.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;

  IF _approve THEN
    UPDATE public.bus_trips
      SET seats_available = GREATEST(seats_available - _b.passengers_count, 0),
          status = CASE WHEN seats_available - _b.passengers_count <= 0 AND seats_total > 0 THEN 'full' ELSE status END
      WHERE id = _b.trip_id AND seats_total > 0;
    UPDATE public.bus_bookings SET status = 'validated', admin_comment = _comment, updated_at = now() WHERE id = _booking_id;
    PERFORM public.notify_user(_b.user_id, 'bus_booking', 'Réservation bus confirmée',
      'Votre réservation ' || _b.reference_code || ' est confirmée. Votre billet sera disponible sous peu.',
      '/mes-reservations', '{}'::jsonb);
  ELSE
    UPDATE public.bus_bookings SET status = 'refused', admin_comment = _comment, updated_at = now() WHERE id = _booking_id;
    PERFORM public.notify_user(_b.user_id, 'bus_booking', 'Réservation bus refusée',
      'Votre réservation ' || _b.reference_code || ' a été refusée. ' || COALESCE(_comment,''),
      '/mes-reservations', '{}'::jsonb);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_decide_bus_booking(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_bus_booking(uuid, boolean, text) TO authenticated;

-- 5. Issue final ticket
CREATE OR REPLACE FUNCTION public.admin_issue_bus_ticket(
  _booking_id uuid, _departure_time text, _boarding_time text, _seat_numbers text, _extra_info text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b public.bus_bookings;
  _num text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO _b FROM public.bus_bookings WHERE id = _booking_id FOR UPDATE;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF _b.status NOT IN ('validated','paid','ticket_sent') THEN RAISE EXCEPTION 'BOOKING_NOT_VALIDATED'; END IF;

  SELECT ticket_number INTO _num FROM public.bus_final_tickets WHERE booking_id = _booking_id;
  IF _num IS NULL THEN
    _num := 'WT-' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8));
    INSERT INTO public.bus_final_tickets(booking_id, ticket_number, departure_time, boarding_time, seat_numbers, extra_info, issued_by)
    VALUES (_booking_id, _num, COALESCE(_departure_time,''), COALESCE(_boarding_time,''), COALESCE(_seat_numbers,''), COALESCE(_extra_info,''), auth.uid());
  ELSE
    UPDATE public.bus_final_tickets SET departure_time = COALESCE(_departure_time,''), boarding_time = COALESCE(_boarding_time,''),
      seat_numbers = COALESCE(_seat_numbers,''), extra_info = COALESCE(_extra_info,''), updated_at = now()
    WHERE booking_id = _booking_id;
  END IF;

  UPDATE public.bus_bookings SET status = 'ticket_sent', updated_at = now() WHERE id = _booking_id;
  PERFORM public.notify_user(_b.user_id, 'bus_booking', 'Billet de bus disponible',
    'Votre billet ' || _num || ' est disponible au téléchargement.', '/mes-reservations', '{}'::jsonb);
  RETURN _num;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_issue_bus_ticket(uuid,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_bus_ticket(uuid,text,text,text,text) TO authenticated;