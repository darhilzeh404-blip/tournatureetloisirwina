CREATE TABLE IF NOT EXISTS public.activity_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  logo_url text,
  contact_phone text,
  contact_email text,
  website text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.activity_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_partners TO authenticated;
GRANT ALL ON public.activity_partners TO service_role;

ALTER TABLE public.activity_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners are viewable by everyone"
  ON public.activity_partners FOR SELECT
  USING (true);

CREATE POLICY "Admins manage partners"
  ON public.activity_partners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER activity_partners_set_updated_at
  BEFORE UPDATE ON public.activity_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transport_activities
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.activity_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS gallery text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS registration_fee integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS requires_child_info boolean NOT NULL DEFAULT true;

ALTER TABLE public.catalog_vehicles
  ADD COLUMN IF NOT EXISTS rental_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS start_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS end_time time NOT NULL DEFAULT '17:00';