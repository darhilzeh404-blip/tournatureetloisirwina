
-- TICKETS
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  conditions text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active tickets" ON public.tickets FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert tickets" ON public.tickets FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update tickets" ON public.tickets FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete tickets" ON public.tickets FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tickets_set_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VEHICLE TYPES
CREATE TABLE public.vehicle_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view vehicle types" ON public.vehicle_types FOR SELECT USING (true);
CREATE POLICY "Admins insert vehicle_types" ON public.vehicle_types FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update vehicle_types" ON public.vehicle_types FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete vehicle_types" ON public.vehicle_types FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER vehicle_types_set_updated BEFORE UPDATE ON public.vehicle_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vehicle_types (name, sort_order) VALUES
  ('Sedan', 1), ('SUV', 2), ('Berline', 3), ('Van', 4), ('Pickup', 5)
ON CONFLICT (name) DO NOTHING;

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-images', 'ticket-images', true)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public read ticket-images" ON storage.objects FOR SELECT USING (bucket_id = 'ticket-images');
CREATE POLICY "Admins upload ticket-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ticket-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update ticket-images" ON storage.objects FOR UPDATE USING (bucket_id = 'ticket-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete ticket-images" ON storage.objects FOR DELETE USING (bucket_id = 'ticket-images' AND has_role(auth.uid(), 'admin'::app_role));
