ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'primaire';

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_level_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_level_check
  CHECK (level IN ('maternelle','primaire','college','lycee'));