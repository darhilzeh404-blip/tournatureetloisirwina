-- Client live positions (client → driver tracking)
CREATE TABLE public.client_positions (
  client_id uuid PRIMARY KEY,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  heading numeric,
  speed numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_positions ENABLE ROW LEVEL SECURITY;

-- Client manages own position
CREATE POLICY "Clients upsert own position"
  ON public.client_positions FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients update own position"
  ON public.client_positions FOR UPDATE
  USING (auth.uid() = client_id);

CREATE POLICY "Clients view own position"
  ON public.client_positions FOR SELECT
  USING (auth.uid() = client_id);

-- Driver assigned to an active trip with this client can view position
CREATE POLICY "Driver views assigned client position"
  ON public.client_positions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.client_id = client_positions.client_id
        AND t.driver_id = auth.uid()
        AND t.status IN ('pending', 'active')
    )
  );

-- Admins see everything
CREATE POLICY "Admins view all client positions"
  ON public.client_positions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_positions;
ALTER TABLE public.client_positions REPLICA IDENTITY FULL;