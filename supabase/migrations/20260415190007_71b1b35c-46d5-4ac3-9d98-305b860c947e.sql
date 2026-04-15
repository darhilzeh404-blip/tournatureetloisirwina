
-- 1. Rename existing 'user' roles to 'client'
UPDATE public.user_roles SET role = 'client' WHERE role = 'user';

-- 2. Add status column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'actif';

-- 3. Create circuits table
CREATE TABLE IF NOT EXISTS public.circuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view circuits" ON public.circuits FOR SELECT USING (true);
CREATE POLICY "Admins can insert circuits" ON public.circuits FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update circuits" ON public.circuits FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete circuits" ON public.circuits FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_circuits_updated_at BEFORE UPDATE ON public.circuits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create user_circuits junction table
CREATE TABLE IF NOT EXISTS public.user_circuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  circuit_id uuid NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, circuit_id)
);

ALTER TABLE public.user_circuits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all user_circuits" ON public.user_circuits FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own assignments" ON public.user_circuits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert user_circuits" ON public.user_circuits FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete user_circuits" ON public.user_circuits FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 5. Update handle_new_user to assign 'client' instead of 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.phone
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$;

-- 6. Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
