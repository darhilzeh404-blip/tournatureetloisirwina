DO $$
DECLARE r record; def text; newdef text;
BEGIN
  FOR r IN SELECT oid FROM pg_proc WHERE proname = 'compute_reservation_amount' AND pronamespace = 'public'::regnamespace LOOP
    def := pg_get_functiondef(r.oid);
    newdef := replace(
      def,
      'v_months := COALESCE((p_details->>''months'')::integer, 1);',
      'v_months := GREATEST(1, LEAST(24, COALESCE(floor((p_details->>''months'')::numeric)::integer, 1)));'
    );
    newdef := replace(
      newdef,
      'v_children := COALESCE((p_details->>''children_count'')::integer, 1);',
      'v_children := GREATEST(1, LEAST(20, COALESCE(floor((p_details->>''children_count'')::numeric)::integer, 1)));'
    );
    IF newdef <> def THEN
      EXECUTE newdef;
    END IF;
  END LOOP;
END $$;