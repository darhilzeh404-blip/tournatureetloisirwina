
-- 1. Add 'agence' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agence';

-- 2. ticket_categories
CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'ticket',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_categories TO anon, authenticated;
GRANT ALL ON public.ticket_categories TO service_role;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views ticket_categories" ON public.ticket_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage ticket_categories" ON public.ticket_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. partner_agencies
CREATE TABLE IF NOT EXISTS public.partner_agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  logo_url text,
  description text NOT NULL DEFAULT '',
  is_verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_agencies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_agencies TO authenticated;
GRANT ALL ON public.partner_agencies TO service_role;
ALTER TABLE public.partner_agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views verified active agencies" ON public.partner_agencies FOR SELECT
  USING (is_active = true OR owner_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Agency owner inserts own" ON public.partner_agencies FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Agency owner updates own" ON public.partner_agencies FOR UPDATE
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Admins manage agencies" ON public.partner_agencies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_partner_agencies_updated_at BEFORE UPDATE ON public.partner_agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. partner_tickets
CREATE TABLE IF NOT EXISTS public.partner_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.ticket_categories(id),
  title text NOT NULL,
  origin text,
  destination text,
  departure_at timestamptz,
  price int NOT NULL DEFAULT 0,
  seats_available int NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_tickets_category ON public.partner_tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_partner_tickets_agency ON public.partner_tickets(agency_id);

GRANT SELECT ON public.partner_tickets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_tickets TO authenticated;
GRANT ALL ON public.partner_tickets TO service_role;
ALTER TABLE public.partner_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views active partner_tickets" ON public.partner_tickets FOR SELECT
  USING (
    is_active = true
    OR EXISTS (SELECT 1 FROM public.partner_agencies a WHERE a.id = agency_id AND a.owner_user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Agency owner inserts tickets" ON public.partner_tickets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.partner_agencies a WHERE a.id = agency_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Agency owner updates own tickets" ON public.partner_tickets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.partner_agencies a WHERE a.id = agency_id AND a.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.partner_agencies a WHERE a.id = agency_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Agency owner deletes own tickets" ON public.partner_tickets FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.partner_agencies a WHERE a.id = agency_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Admins manage partner_tickets" ON public.partner_tickets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_partner_tickets_updated_at BEFORE UPDATE ON public.partner_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed categories
INSERT INTO public.ticket_categories (slug, name, icon, sort_order) VALUES
  ('bus', 'Bus', 'bus', 1),
  ('train', 'Train', 'train', 2),
  ('avion', 'Avion', 'plane', 3),
  ('bateau', 'Bateau / Ferry', 'ship', 4),
  ('evenement', 'Événement', 'party-popper', 5)
ON CONFLICT (slug) DO NOTHING;

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-tickets', 'partner-tickets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read partner-tickets" ON storage.objects FOR SELECT
  USING (bucket_id = 'partner-tickets');
CREATE POLICY "Authenticated upload partner-tickets" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'partner-tickets' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner update partner-tickets" ON storage.objects FOR UPDATE
  USING (bucket_id = 'partner-tickets' AND owner = auth.uid());
CREATE POLICY "Owner delete partner-tickets" ON storage.objects FOR DELETE
  USING (bucket_id = 'partner-tickets' AND owner = auth.uid());
