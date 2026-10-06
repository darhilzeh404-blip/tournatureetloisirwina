DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('train_baggage_rules','train_baggage_rules_public_read'),
    ('offers','Anyone can view active offers'),
    ('extra_activities','extra_activities read'),
    ('activity_partners','Partners are viewable by everyone'),
    ('transport_routes','Anyone can view transport_routes'),
    ('transport_packages','Anyone can view transport_packages'),
    ('transport_activities','Anyone can view transport_activities'),
    ('vehicle_types','Anyone can view vehicle types'),
    ('transport_vehicles','Anyone can view transport_vehicles'),
    ('group_bus_trips','group_bus_trips read'),
    ('circuits','Anyone can view circuits'),
    ('transport_categories','Anyone can view transport_categories')
  ) AS t(tbl, pol) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (is_active = true OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), ''admin''::public.app_role)))', r.pol, r.tbl);
  END LOOP;
END $$;