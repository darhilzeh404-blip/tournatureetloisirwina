
-- Enum catégorie VTC
DO $$ BEGIN
  CREATE TYPE public.vtc_category AS ENUM ('STANDARD','CONFORT','VIP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ajout de la colonne category sur vehicle_types
ALTER TABLE public.vehicle_types
  ADD COLUMN IF NOT EXISTS category public.vtc_category NOT NULL DEFAULT 'STANDARD';

-- Ajout de la colonne category sur drivers
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS category public.vtc_category NOT NULL DEFAULT 'STANDARD';
