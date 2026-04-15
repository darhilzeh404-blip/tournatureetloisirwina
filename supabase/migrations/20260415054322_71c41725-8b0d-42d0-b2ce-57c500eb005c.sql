
-- Table buses
CREATE TABLE public.buses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  immatriculation TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT '16 places',
  statut TEXT NOT NULL DEFAULT 'Disponible',
  chauffeur TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view buses" ON public.buses FOR SELECT USING (true);
CREATE POLICY "Admins can insert buses" ON public.buses FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update buses" ON public.buses FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete buses" ON public.buses FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_buses_updated_at BEFORE UPDATE ON public.buses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table offers
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  service_type TEXT NOT NULL DEFAULT 'LOCATION_BUS',
  price INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offers" ON public.offers FOR SELECT USING (true);
CREATE POLICY "Admins can insert offers" ON public.offers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update offers" ON public.offers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete offers" ON public.offers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
