
-- Create rides table
CREATE TABLE public.rides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pickup text NOT NULL,
  destination text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'disponible',
  driver_id uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL,
  scheduled_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_rides_updated_at
BEFORE UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Admin: full access
CREATE POLICY "Admins full access rides" ON public.rides
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Chauffeurs: can see available rides + their own assigned rides
CREATE POLICY "Chauffeurs can view available and own rides" ON public.rides
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'chauffeur'::app_role)
  AND (status = 'disponible' OR driver_id = auth.uid())
);

-- Chauffeurs: can accept a ride only if status is 'disponible'
CREATE POLICY "Chauffeurs can accept available rides" ON public.rides
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'chauffeur'::app_role)
  AND status = 'disponible'
)
WITH CHECK (
  has_role(auth.uid(), 'chauffeur'::app_role)
  AND driver_id = auth.uid()
  AND status = 'en_cours'
);

-- Gérants: can view all rides
CREATE POLICY "Gerants can view all rides" ON public.rides
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'gerant'::app_role));

-- View for gérants without price
CREATE VIEW public.rides_gerant AS
SELECT id, pickup, destination, status, driver_id, created_by, scheduled_at, notes, created_at, updated_at
FROM public.rides;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
