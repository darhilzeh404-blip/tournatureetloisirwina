ALTER TABLE public.circuits
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'Gabon',
  ADD COLUMN IF NOT EXISTS rating numeric(2,1) NOT NULL DEFAULT 4.8;

ALTER TABLE public.transport_activities
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'Gabon',
  ADD COLUMN IF NOT EXISTS rating numeric(2,1) NOT NULL DEFAULT 4.7;