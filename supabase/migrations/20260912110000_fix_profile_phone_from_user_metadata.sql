CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_phone text;
BEGIN
  profile_phone := COALESCE(
    NULLIF(btrim(NEW.phone), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'phone'), '')
  );

  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    profile_phone
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  RETURN NEW;
END;
$$;

UPDATE public.profiles AS p
SET phone = NULLIF(btrim(u.raw_user_meta_data->>'phone'), '')
FROM auth.users AS u
WHERE u.id = p.user_id
  AND (p.phone IS NULL OR btrim(p.phone) = '')
  AND NULLIF(btrim(u.raw_user_meta_data->>'phone'), '') IS NOT NULL;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
