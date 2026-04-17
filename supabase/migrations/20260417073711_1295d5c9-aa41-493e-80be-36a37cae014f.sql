-- Table trips : lien réservation ↔ chauffeur avec coords
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  driver_id UUID,
  origin_address TEXT NOT NULL DEFAULT '',
  origin_lat NUMERIC(10, 7),
  origin_lng NUMERIC(10, 7),
  destination_address TEXT NOT NULL DEFAULT '',
  destination_lat NUMERIC(10, 7),
  destination_lng NUMERIC(10, 7),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | completed | cancelled
  eta_minutes INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_client ON public.trips(client_id);
CREATE INDEX idx_trips_driver ON public.trips(driver_id);
CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_trips_reservation ON public.trips(reservation_id);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view own trips" ON public.trips
  FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Drivers view assigned trips" ON public.trips
  FOR SELECT USING (auth.uid() = driver_id AND has_role(auth.uid(), 'chauffeur'::app_role));

CREATE POLICY "Drivers update assigned trips" ON public.trips
  FOR UPDATE USING (auth.uid() = driver_id AND has_role(auth.uid(), 'chauffeur'::app_role));

CREATE POLICY "Admins full access trips" ON public.trips
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table driver_positions : 1 ligne par chauffeur, UPSERT continu
CREATE TABLE public.driver_positions (
  driver_id UUID NOT NULL PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  heading NUMERIC(5, 2),
  speed NUMERIC(6, 2),
  accuracy NUMERIC(8, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_positions_trip ON public.driver_positions(trip_id);
CREATE INDEX idx_driver_positions_updated ON public.driver_positions(updated_at);

ALTER TABLE public.driver_positions ENABLE ROW LEVEL SECURITY;

-- Le chauffeur insère/met à jour sa propre position
CREATE POLICY "Drivers upsert own position" ON public.driver_positions
  FOR INSERT WITH CHECK (auth.uid() = driver_id AND has_role(auth.uid(), 'chauffeur'::app_role));

CREATE POLICY "Drivers update own position" ON public.driver_positions
  FOR UPDATE USING (auth.uid() = driver_id AND has_role(auth.uid(), 'chauffeur'::app_role));

CREATE POLICY "Drivers view own position" ON public.driver_positions
  FOR SELECT USING (auth.uid() = driver_id);

-- Le client voit la position du chauffeur SI il a un trip actif avec lui
CREATE POLICY "Clients view assigned driver position" ON public.driver_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.driver_id = driver_positions.driver_id
        AND t.client_id = auth.uid()
        AND t.status = 'active'
    )
  );

-- L'admin voit tout
CREATE POLICY "Admins view all positions" ON public.driver_positions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_positions;
ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.driver_positions REPLICA IDENTITY FULL;