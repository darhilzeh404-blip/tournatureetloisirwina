
-- 1. Make owner_user_id optional on partner_agencies + add commission %
ALTER TABLE public.partner_agencies
  ALTER COLUMN owner_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2) NOT NULL DEFAULT 10;

-- 2. Add new service_type enum value for catalog rentals
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'LOCATION_CATALOGUE';

-- 3. Commission overrides per (agency, transport category slug)
CREATE TABLE IF NOT EXISTS public.partner_commission_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  category text NOT NULL,
  commission_percent numeric(5,2) NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, category)
);

GRANT SELECT ON public.partner_commission_rates TO anon, authenticated;
GRANT ALL ON public.partner_commission_rates TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.partner_commission_rates TO authenticated;

ALTER TABLE public.partner_commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read commission rates"
  ON public.partner_commission_rates FOR SELECT
  USING (true);

CREATE POLICY "Admins manage commission rates"
  ON public.partner_commission_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_partner_commission_rates_updated
  BEFORE UPDATE ON public.partner_commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
