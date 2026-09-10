-- Safe backfill for projects that were created before the notifications and
-- bus-ticketing modules. This migration is additive: it never drops data.

-- Generic user notifications -------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON public.user_notifications (user_id, is_read, created_at DESC);

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "un_select_own" ON public.user_notifications;
CREATE POLICY "un_select_own" ON public.user_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "un_update_own" ON public.user_notifications;
CREATE POLICY "un_update_own" ON public.user_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "un_block_anon" ON public.user_notifications;
CREATE POLICY "un_block_anon" ON public.user_notifications
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END;
$$;

-- Bus trips and bookings ------------------------------------------------------
-- partner_agencies and has_role already exist in the base schema.
CREATE TABLE IF NOT EXISTS public.bus_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  origin text NOT NULL,
  destination text NOT NULL,
  departure_date date,
  date_start date NOT NULL DEFAULT CURRENT_DATE,
  date_end date NOT NULL DEFAULT CURRENT_DATE,
  bus_type text NOT NULL DEFAULT '',
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
  CONSTRAINT bus_trips_status_check CHECK (status IN ('available', 'full', 'cancelled')),
  CONSTRAINT bus_trips_period_check CHECK (date_end >= date_start),
  CONSTRAINT bus_trips_seats_check CHECK (seats_available >= 0 AND seats_available <= seats_total)
);

CREATE INDEX IF NOT EXISTS bus_trips_agency_date_idx
  ON public.bus_trips (agency_id, date_start, date_end);

GRANT SELECT ON public.bus_trips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_trips TO authenticated;
GRANT ALL ON public.bus_trips TO service_role;
ALTER TABLE public.bus_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bus_trips_public_read" ON public.bus_trips;
CREATE POLICY "bus_trips_public_read" ON public.bus_trips
  FOR SELECT TO anon, authenticated USING (status <> 'cancelled');

DROP POLICY IF EXISTS "bus_trips_admin_all" ON public.bus_trips;
CREATE POLICY "bus_trips_admin_all" ON public.bus_trips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.bus_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.bus_trips(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  reference_code text NOT NULL UNIQUE,
  booker_name text NOT NULL,
  booker_phone text NOT NULL,
  id_document_url text NOT NULL,
  passengers_count integer NOT NULL DEFAULT 1,
  adults_count integer NOT NULL DEFAULT 0,
  children_count integer NOT NULL DEFAULT 0,
  infants_count integer NOT NULL DEFAULT 0,
  baggage_count integer NOT NULL DEFAULT 0,
  baggage_notes text NOT NULL DEFAULT '',
  travel_date date,
  tickets_total integer NOT NULL DEFAULT 0,
  baggage_total integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reservation_id uuid,
  admin_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_bookings_status_check
    CHECK (status IN ('pending', 'validated', 'refused', 'paid', 'ticket_sent', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS bus_bookings_user_created_idx
  ON public.bus_bookings (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.bus_bookings TO authenticated;
GRANT ALL ON public.bus_bookings TO service_role;
ALTER TABLE public.bus_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bus_bookings_owner_read" ON public.bus_bookings;
CREATE POLICY "bus_bookings_owner_read" ON public.bus_bookings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "bus_bookings_admin_write" ON public.bus_bookings;
CREATE POLICY "bus_bookings_admin_write" ON public.bus_bookings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

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
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

GRANT SELECT ON public.bus_final_tickets TO authenticated;
GRANT ALL ON public.bus_final_tickets TO service_role;
ALTER TABLE public.bus_final_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bus_final_tickets_owner_read" ON public.bus_final_tickets;
CREATE POLICY "bus_final_tickets_owner_read" ON public.bus_final_tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.bus_bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bus_final_tickets_admin_all" ON public.bus_final_tickets;
CREATE POLICY "bus_final_tickets_admin_all" ON public.bus_final_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bus_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_bookings;
  END IF;
END;
$$;
