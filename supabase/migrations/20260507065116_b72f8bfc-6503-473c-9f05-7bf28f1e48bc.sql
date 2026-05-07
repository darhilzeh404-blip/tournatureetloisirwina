CREATE TABLE IF NOT EXISTS public.driver_availability (
  driver_id uuid PRIMARY KEY,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own availability"
ON public.driver_availability FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers upsert own availability"
ON public.driver_availability FOR INSERT
WITH CHECK (auth.uid() = driver_id AND has_role(auth.uid(), 'chauffeur'::app_role));

CREATE POLICY "Drivers update own availability"
ON public.driver_availability FOR UPDATE
USING (auth.uid() = driver_id AND has_role(auth.uid(), 'chauffeur'::app_role));

CREATE POLICY "Admins view all availability"
ON public.driver_availability FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_driver_availability_updated
BEFORE UPDATE ON public.driver_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();