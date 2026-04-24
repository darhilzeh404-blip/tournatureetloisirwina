-- Ajouter colonne archived_at
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.driver_positions ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.client_positions ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Masquer les enregistrements archivés aux utilisateurs (admin garde déjà accès via has_role)
DROP POLICY IF EXISTS "Users can view their own reservations" ON public.reservations;
CREATE POLICY "Users can view their own reservations"
  ON public.reservations FOR SELECT
  USING (auth.uid() = user_id AND archived_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id AND archived_at IS NULL);

DROP POLICY IF EXISTS "Drivers view assigned trips" ON public.trips;
CREATE POLICY "Drivers view assigned trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = driver_id AND has_role(auth.uid(), 'chauffeur'::app_role) AND archived_at IS NULL);

DROP POLICY IF EXISTS "Clients view own trips" ON public.trips;
CREATE POLICY "Clients view own trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = client_id AND archived_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id AND archived_at IS NULL);