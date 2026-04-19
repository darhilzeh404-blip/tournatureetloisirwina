-- 1. Add gerant_id to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS gerant_id uuid;

CREATE INDEX IF NOT EXISTS idx_trips_gerant_id ON public.trips(gerant_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_client_id ON public.trips(client_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);

-- 2. RLS: gerants can view trips assigned to them
DROP POLICY IF EXISTS "Gerants view assigned trips" ON public.trips;
CREATE POLICY "Gerants view assigned trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (auth.uid() = gerant_id AND has_role(auth.uid(), 'gerant'::app_role));

-- 3. RLS: gerants can update trips assigned to them (status changes)
DROP POLICY IF EXISTS "Gerants update assigned trips" ON public.trips;
CREATE POLICY "Gerants update assigned trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = gerant_id AND has_role(auth.uid(), 'gerant'::app_role))
  WITH CHECK (auth.uid() = gerant_id AND has_role(auth.uid(), 'gerant'::app_role));

-- 4. RLS: admins can INSERT trips (for assignation flow)
DROP POLICY IF EXISTS "Admins can insert trips" ON public.trips;
CREATE POLICY "Admins can insert trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Enable realtime on trips
ALTER TABLE public.trips REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  END IF;
END $$;