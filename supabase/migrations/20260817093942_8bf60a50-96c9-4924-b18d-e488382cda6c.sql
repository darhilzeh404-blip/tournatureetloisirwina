DO $do$
DECLARE
  r record;
  src text;
  patched text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'compute_reservation_amount'
  LOOP
    src := pg_get_functiondef(r.oid);
    IF position('trip_type'' , ''aller_retour' in src) > 0 THEN
      CONTINUE;
    END IF;
    patched := replace(
      src,
      E'      IF v_amount IS NOT NULL THEN\n        RETURN v_amount * v_months * v_children;',
      E'      IF v_amount IS NOT NULL THEN\n        IF lower(COALESCE(p_details->>''trip_type'', ''aller_retour'')) IN (''aller_simple'', ''retour_simple'') THEN\n          v_amount := (v_amount / 2) + 10000;\n        END IF;\n        RETURN v_amount * v_months * v_children;'
    );
    IF patched <> src THEN
      EXECUTE patched;
    END IF;
  END LOOP;
END
$do$;