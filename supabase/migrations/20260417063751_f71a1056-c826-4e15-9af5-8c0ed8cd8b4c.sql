ALTER TABLE public.rides REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.rides;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT (public.has_role(_uid, 'chauffeur'::app_role)
       OR public.has_role(_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.rides
     SET status = 'en_cours',
         driver_id = _uid,
         updated_at = now()
   WHERE id = _ride_id
     AND status = 'disponible'
     AND driver_id IS NULL
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_ride(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_ride(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_ride(_ride_id uuid)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.rides;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE public.rides
     SET status = 'terminee',
         updated_at = now()
   WHERE id = _ride_id
     AND status = 'en_cours'
     AND (driver_id = _uid OR public.has_role(_uid, 'admin'::app_role))
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_ride(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_ride(uuid) TO authenticated;