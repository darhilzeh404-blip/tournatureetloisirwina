CREATE TABLE public.vtc_horn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  client_id uuid NOT NULL,
  driver_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vtc_horn_events TO authenticated;
GRANT ALL ON public.vtc_horn_events TO service_role;
ALTER TABLE public.vtc_horn_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client reads own horn events" ON public.vtc_horn_events
  FOR SELECT TO authenticated USING (client_id = auth.uid() OR driver_user_id = auth.uid());
CREATE INDEX vtc_horn_events_res_idx ON public.vtc_horn_events(reservation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.send_vtc_horn(_reservation_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _trip record; _last timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT t.* INTO _trip FROM public.trips t
   WHERE t.reservation_id = _reservation_id
     AND t.status NOT IN ('completed','cancelled','annule','termine')
     AND (t.driver_id = auth.uid() OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = t.driver_id AND d.user_id = auth.uid()))
   ORDER BY t.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Seul le chauffeur assigné à cette course peut klaxonner'; END IF;
  SELECT max(created_at) INTO _last FROM public.vtc_horn_events WHERE reservation_id = _reservation_id;
  IF _last IS NOT NULL AND _last > now() - interval '10 seconds' THEN
    RAISE EXCEPTION 'Patientez quelques secondes avant de klaxonner à nouveau';
  END IF;
  INSERT INTO public.vtc_horn_events(reservation_id, client_id, driver_user_id)
  VALUES (_reservation_id, _trip.client_id, auth.uid());
  RETURN now();
END $$;
REVOKE ALL ON FUNCTION public.send_vtc_horn(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_vtc_horn(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.vtc_horn_events;