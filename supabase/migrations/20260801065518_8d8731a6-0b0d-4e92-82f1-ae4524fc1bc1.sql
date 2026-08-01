DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
      AND (coalesce(qual,'') ILIKE '%has_role%' OR coalesce(with_check,'') ILIKE '%has_role%'
           OR coalesce(qual,'') ILIKE '%auth.uid()%' OR coalesce(with_check,'') ILIKE '%auth.uid()%')
      AND coalesce(qual,'') NOT ILIKE '%is_active%'
      AND coalesce(with_check,'') NOT ILIKE '%is_active%'
      AND policyname NOT ILIKE '%public%'
      AND policyname NOT ILIKE '%anyone%'
      AND policyname NOT ILIKE '%anon%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER POLICY "Admins can insert buses" ON public.buses TO authenticated;
ALTER POLICY "Admins can update buses" ON public.buses TO authenticated;
ALTER POLICY "Admins can delete buses" ON public.buses TO authenticated;
