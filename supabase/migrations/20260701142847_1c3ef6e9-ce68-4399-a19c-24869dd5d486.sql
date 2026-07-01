
-- 1) Fix client visibility: grant SELECT on the public agency view
GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;
GRANT ALL ON public.partner_agencies_public TO service_role;

-- 2) Application fees table (admin-managed)
CREATE TABLE IF NOT EXISTS public.application_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  service_type text,           -- 'VTC','BUS','SCOLAIRE','LOCATION','CIRCUIT','BILLET' or NULL for all
  fee_type text NOT NULL CHECK (fee_type IN ('percentage','fixed')),
  amount numeric NOT NULL CHECK (amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_fees TO authenticated;
GRANT SELECT ON public.application_fees TO anon;
GRANT ALL ON public.application_fees TO service_role;

ALTER TABLE public.application_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active fees"
  ON public.application_fees FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage fees"
  ON public.application_fees FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER application_fees_set_updated_at
  BEFORE UPDATE ON public.application_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
