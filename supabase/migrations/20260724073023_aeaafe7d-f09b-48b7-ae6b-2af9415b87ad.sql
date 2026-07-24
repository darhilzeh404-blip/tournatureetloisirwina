
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.flight_program_status AS ENUM ('draft','active','closed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flight_booking_status AS ENUM (
    'pending_payment','paid','confirmed_by_agency','ticket_ready',
    'delivered','cancelled','refunded','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flight_delivery_method AS ENUM ('pickup_wina','delivery_home','email_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flight_payment_status AS ENUM ('pending','success','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ PICKUP LOCATIONS ============
CREATE TABLE IF NOT EXISTS public.flight_pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.flight_pickup_locations TO anon, authenticated;
GRANT ALL ON public.flight_pickup_locations TO service_role;
ALTER TABLE public.flight_pickup_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pickup_public_read" ON public.flight_pickup_locations;
CREATE POLICY "pickup_public_read" ON public.flight_pickup_locations
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "pickup_admin_write" ON public.flight_pickup_locations;
CREATE POLICY "pickup_admin_write" ON public.flight_pickup_locations
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.flight_pickup_locations (name, address, city, sort_order) VALUES
  ('Agence WINA Libreville','Boulevard Triomphal','Libreville',1),
  ('Agence WINA Port-Gentil','Centre-ville','Port-Gentil',2)
ON CONFLICT DO NOTHING;

-- ============ FLIGHT PROGRAMS ============
CREATE TABLE IF NOT EXISTS public.flight_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  airline_name text,
  flight_number text,
  origin text NOT NULL,
  origin_iata text,
  destination text NOT NULL,
  destination_iata text,
  departure_at timestamptz NOT NULL,
  arrival_at timestamptz,
  class text NOT NULL DEFAULT 'ECONOMY',
  baggage_allowance text,
  price integer NOT NULL CHECK (price >= 0),
  service_fee integer NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  currency text NOT NULL DEFAULT 'XAF',
  seats_total integer NOT NULL CHECK (seats_total > 0),
  seats_available integer NOT NULL CHECK (seats_available >= 0),
  description text,
  image_url text,
  status public.flight_program_status NOT NULL DEFAULT 'draft',
  is_active boolean NOT NULL DEFAULT true,
  program_month date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flight_programs_departure ON public.flight_programs(departure_at);
CREATE INDEX IF NOT EXISTS idx_flight_programs_agency ON public.flight_programs(agency_id);
GRANT SELECT ON public.flight_programs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.flight_programs TO authenticated;
GRANT ALL ON public.flight_programs TO service_role;
ALTER TABLE public.flight_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "programs_public_read_active" ON public.flight_programs;
CREATE POLICY "programs_public_read_active" ON public.flight_programs
  FOR SELECT USING (
    (is_active = true AND status = 'active')
    OR public.has_role(auth.uid(),'admin')
  );
DROP POLICY IF EXISTS "programs_admin_write" ON public.flight_programs;
CREATE POLICY "programs_admin_write" ON public.flight_programs
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SEGMENTS ============
CREATE TABLE IF NOT EXISTS public.flight_program_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.flight_programs(id) ON DELETE CASCADE,
  segment_order smallint NOT NULL,
  airline_name text,
  flight_number text,
  origin text NOT NULL,
  origin_iata text,
  destination text NOT NULL,
  destination_iata text,
  departure_at timestamptz NOT NULL,
  arrival_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, segment_order)
);
GRANT SELECT ON public.flight_program_segments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.flight_program_segments TO authenticated;
GRANT ALL ON public.flight_program_segments TO service_role;
ALTER TABLE public.flight_program_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "segments_public_read" ON public.flight_program_segments;
CREATE POLICY "segments_public_read" ON public.flight_program_segments
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.flight_programs p WHERE p.id = program_id
           AND ((p.is_active AND p.status='active') OR public.has_role(auth.uid(),'admin')))
  );
DROP POLICY IF EXISTS "segments_admin_write" ON public.flight_program_segments;
CREATE POLICY "segments_admin_write" ON public.flight_program_segments
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ BOOKINGS ============
CREATE TABLE IF NOT EXISTS public.flight_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text UNIQUE NOT NULL DEFAULT ('FL-' || upper(substring(md5(random()::text || clock_timestamp()::text),1,8))),
  program_id uuid NOT NULL REFERENCES public.flight_programs(id) ON DELETE RESTRICT,
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  seats integer NOT NULL CHECK (seats > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  service_fee integer NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  delivery_method public.flight_delivery_method NOT NULL DEFAULT 'pickup_wina',
  pickup_location_id uuid REFERENCES public.flight_pickup_locations(id) ON DELETE SET NULL,
  delivery_address text,
  status public.flight_booking_status NOT NULL DEFAULT 'pending_payment',
  agency_notified_at timestamptz,
  agency_pdf_url text,
  ticket_pdf_url text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flight_bookings_user ON public.flight_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_bookings_program ON public.flight_bookings(program_id);
CREATE INDEX IF NOT EXISTS idx_flight_bookings_status ON public.flight_bookings(status);
GRANT SELECT, INSERT, UPDATE ON public.flight_bookings TO authenticated;
GRANT ALL ON public.flight_bookings TO service_role;
ALTER TABLE public.flight_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookings_owner_read" ON public.flight_bookings;
CREATE POLICY "bookings_owner_read" ON public.flight_bookings
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "bookings_user_create" ON public.flight_bookings;
CREATE POLICY "bookings_user_create" ON public.flight_bookings
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "bookings_admin_update" ON public.flight_bookings;
CREATE POLICY "bookings_admin_update" ON public.flight_bookings
  FOR UPDATE USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ PASSENGERS ============
CREATE TABLE IF NOT EXISTS public.flight_booking_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  gender text,
  nationality text,
  passport_number text NOT NULL,
  passport_expiry date,
  passport_photo_url text NOT NULL,
  seat_index smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flight_passengers_booking ON public.flight_booking_passengers(booking_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_booking_passengers TO authenticated;
GRANT ALL ON public.flight_booking_passengers TO service_role;
ALTER TABLE public.flight_booking_passengers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "passengers_owner_access" ON public.flight_booking_passengers;
CREATE POLICY "passengers_owner_access" ON public.flight_booking_passengers
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.flight_bookings b WHERE b.id = booking_id
           AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  )
  WITH CHECK (
    EXISTS(SELECT 1 FROM public.flight_bookings b WHERE b.id = booking_id
           AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS public.flight_booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mypvit',
  provider_reference text,
  amount integer NOT NULL CHECK (amount >= 0),
  status public.flight_payment_status NOT NULL DEFAULT 'pending',
  payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flight_payments_booking ON public.flight_booking_payments(booking_id);
GRANT SELECT, INSERT, UPDATE ON public.flight_booking_payments TO authenticated;
GRANT ALL ON public.flight_booking_payments TO service_role;
ALTER TABLE public.flight_booking_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_owner_read" ON public.flight_booking_payments;
CREATE POLICY "payments_owner_read" ON public.flight_booking_payments
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.flight_bookings b WHERE b.id = booking_id
           AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
DROP POLICY IF EXISTS "payments_admin_write" ON public.flight_booking_payments;
CREATE POLICY "payments_admin_write" ON public.flight_booking_payments
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ TRACKING ============
CREATE TABLE IF NOT EXISTS public.flight_booking_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
  from_status public.flight_booking_status,
  to_status public.flight_booking_status NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flight_tracking_booking ON public.flight_booking_tracking(booking_id);
GRANT SELECT, INSERT ON public.flight_booking_tracking TO authenticated;
GRANT ALL ON public.flight_booking_tracking TO service_role;
ALTER TABLE public.flight_booking_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tracking_owner_read" ON public.flight_booking_tracking;
CREATE POLICY "tracking_owner_read" ON public.flight_booking_tracking
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.flight_bookings b WHERE b.id = booking_id
           AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
DROP POLICY IF EXISTS "tracking_admin_insert" ON public.flight_booking_tracking;
CREATE POLICY "tracking_admin_insert" ON public.flight_booking_tracking
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ DELIVERY LOGS ============
CREATE TABLE IF NOT EXISTS public.flight_booking_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
  event text NOT NULL,
  location text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.flight_booking_delivery_logs TO authenticated;
GRANT ALL ON public.flight_booking_delivery_logs TO service_role;
ALTER TABLE public.flight_booking_delivery_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_logs_owner_read" ON public.flight_booking_delivery_logs;
CREATE POLICY "delivery_logs_owner_read" ON public.flight_booking_delivery_logs
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.flight_bookings b WHERE b.id = booking_id
           AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
DROP POLICY IF EXISTS "delivery_logs_admin_insert" ON public.flight_booking_delivery_logs;
CREATE POLICY "delivery_logs_admin_insert" ON public.flight_booking_delivery_logs
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ PROGRAM FILES ============
CREATE TABLE IF NOT EXISTS public.flight_program_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.flight_programs(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.flight_program_files TO authenticated;
GRANT ALL ON public.flight_program_files TO service_role;
ALTER TABLE public.flight_program_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_files_admin_all" ON public.flight_program_files;
CREATE POLICY "program_files_admin_all" ON public.flight_program_files
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SEAT INVENTORY TRIGGER ============
CREATE OR REPLACE FUNCTION public.flight_bookings_manage_seats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _avail integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('cancelled','failed','refunded') THEN RETURN NEW; END IF;
    SELECT seats_available INTO _avail FROM public.flight_programs WHERE id = NEW.program_id FOR UPDATE;
    IF _avail IS NULL THEN RAISE EXCEPTION 'PROGRAM_NOT_FOUND'; END IF;
    IF _avail < NEW.seats THEN RAISE EXCEPTION 'INSUFFICIENT_SEATS'; END IF;
    UPDATE public.flight_programs SET seats_available = seats_available - NEW.seats, updated_at = now()
      WHERE id = NEW.program_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status NOT IN ('cancelled','failed','refunded')
       AND NEW.status IN ('cancelled','failed','refunded') THEN
      UPDATE public.flight_programs SET seats_available = seats_available + OLD.seats, updated_at = now()
        WHERE id = OLD.program_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_flight_bookings_seats ON public.flight_bookings;
CREATE TRIGGER trg_flight_bookings_seats
  BEFORE INSERT OR UPDATE ON public.flight_bookings
  FOR EACH ROW EXECUTE FUNCTION public.flight_bookings_manage_seats();

-- ============ STATUS TRACKING TRIGGER ============
CREATE OR REPLACE FUNCTION public.flight_bookings_track_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.flight_booking_tracking(booking_id, from_status, to_status, actor_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_flight_bookings_track ON public.flight_bookings;
CREATE TRIGGER trg_flight_bookings_track
  AFTER UPDATE ON public.flight_bookings
  FOR EACH ROW EXECUTE FUNCTION public.flight_bookings_track_status();

-- ============ updated_at TRIGGERS ============
DROP TRIGGER IF EXISTS trg_flight_programs_updated ON public.flight_programs;
CREATE TRIGGER trg_flight_programs_updated BEFORE UPDATE ON public.flight_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_flight_bookings_updated ON public.flight_bookings;
CREATE TRIGGER trg_flight_bookings_updated BEFORE UPDATE ON public.flight_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_flight_payments_updated ON public.flight_booking_payments;
CREATE TRIGGER trg_flight_payments_updated BEFORE UPDATE ON public.flight_booking_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_flight_pickup_updated ON public.flight_pickup_locations;
CREATE TRIGGER trg_flight_pickup_updated BEFORE UPDATE ON public.flight_pickup_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE POLICIES for `passports` bucket ============
DROP POLICY IF EXISTS "passports_owner_insert" ON storage.objects;
CREATE POLICY "passports_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'passports' AND (auth.uid())::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "passports_owner_read" ON storage.objects;
CREATE POLICY "passports_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'passports'
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "passports_owner_delete" ON storage.objects;
CREATE POLICY "passports_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'passports'
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
