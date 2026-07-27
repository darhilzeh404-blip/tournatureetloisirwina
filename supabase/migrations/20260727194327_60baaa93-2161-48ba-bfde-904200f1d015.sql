-- 1. Routes maritimes
CREATE TABLE public.boat_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE RESTRICT,
  origin text NOT NULL,
  destination text NOT NULL,
  distance_km numeric NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boat_routes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boat_routes TO authenticated;
GRANT ALL ON public.boat_routes TO service_role;
ALTER TABLE public.boat_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active boat routes" ON public.boat_routes FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage boat routes" ON public.boat_routes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Navires
CREATE TABLE public.vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE RESTRICT,
  name text NOT NULL,
  photo_url text,
  capacity integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  baggage_adult_kg integer NOT NULL DEFAULT 20,
  baggage_child_kg integer NOT NULL DEFAULT 10,
  baggage_infant_kg integer NOT NULL DEFAULT 0,
  fee_per_extra_kg integer NOT NULL DEFAULT 0,
  baggage_conditions text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vessels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vessels TO authenticated;
GRANT ALL ON public.vessels TO service_role;
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active vessels" ON public.vessels FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage vessels" ON public.vessels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Services par navire
CREATE TABLE public.vessel_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'sparkles',
  price integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vessel_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vessel_services TO authenticated;
GRANT ALL ON public.vessel_services TO service_role;
ALTER TABLE public.vessel_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view vessel services" ON public.vessel_services FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage vessel services" ON public.vessel_services FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Départs (sailings)
CREATE TABLE public.boat_sailings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES public.vessels(id) ON DELETE RESTRICT,
  route_id uuid NOT NULL REFERENCES public.boat_routes(id) ON DELETE RESTRICT,
  departure_date date NOT NULL,
  departure_time time NOT NULL DEFAULT '08:00',
  price_adult integer NOT NULL DEFAULT 0,
  price_child integer NOT NULL DEFAULT 0,
  price_infant integer NOT NULL DEFAULT 0,
  seats_total integer NOT NULL DEFAULT 0,
  seats_available integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','full','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boat_sailings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boat_sailings TO authenticated;
GRANT ALL ON public.boat_sailings TO service_role;
ALTER TABLE public.boat_sailings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view boat sailings" ON public.boat_sailings FOR SELECT USING (status <> 'cancelled' OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage boat sailings" ON public.boat_sailings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Lien réservation -> départ
ALTER TABLE public.partner_bookings
  ADD COLUMN IF NOT EXISTS sailing_id uuid REFERENCES public.boat_sailings(id) ON DELETE SET NULL;

-- 6. Passagers navire
CREATE TABLE public.boat_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.partner_bookings(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('adult','child','infant')),
  last_name text NOT NULL,
  first_name text NOT NULL,
  email text,
  phone text,
  id_document text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boat_passengers TO authenticated;
GRANT ALL ON public.boat_passengers TO service_role;
ALTER TABLE public.boat_passengers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their boat passengers" ON public.boat_passengers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.partner_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
CREATE POLICY "Owners insert their boat passengers" ON public.boat_passengers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.partner_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
CREATE POLICY "Admins manage boat passengers" ON public.boat_passengers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Décompte automatique des places du départ
CREATE OR REPLACE FUNCTION public.boat_sailings_manage_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _avail integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sailing_id IS NULL OR NEW.status = 'cancelled' THEN RETURN NEW; END IF;
    SELECT seats_available INTO _avail FROM public.boat_sailings WHERE id = NEW.sailing_id FOR UPDATE;
    IF _avail IS NULL THEN RAISE EXCEPTION 'SAILING_NOT_FOUND'; END IF;
    IF _avail < NEW.seats THEN RAISE EXCEPTION 'INSUFFICIENT_SEATS'; END IF;
    UPDATE public.boat_sailings
      SET seats_available = seats_available - NEW.seats,
          status = CASE WHEN seats_available - NEW.seats <= 0 THEN 'full' ELSE status END,
          updated_at = now()
      WHERE id = NEW.sailing_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.sailing_id IS NOT NULL AND OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
      UPDATE public.boat_sailings
        SET seats_available = LEAST(seats_total, seats_available + OLD.seats),
            status = CASE WHEN status = 'full' THEN 'active' ELSE status END,
            updated_at = now()
        WHERE id = OLD.sailing_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER partner_bookings_boat_seats
AFTER INSERT OR UPDATE ON public.partner_bookings
FOR EACH ROW EXECUTE FUNCTION public.boat_sailings_manage_seats();

CREATE TRIGGER boat_routes_set_updated_at BEFORE UPDATE ON public.boat_routes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER vessels_set_updated_at BEFORE UPDATE ON public.vessels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER boat_sailings_set_updated_at BEFORE UPDATE ON public.boat_sailings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();