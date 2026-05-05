CREATE OR REPLACE FUNCTION public.archive_trip_and_reservation(_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _trip public.trips;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO _trip FROM public.trips WHERE id = _trip_id;
  IF _trip.id IS NULL THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  IF NOT (
    _trip.driver_id = _uid
    OR _trip.gerant_id = _uid
    OR public.has_role(_uid, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.trips
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        archived_at = COALESCE(archived_at, now()),
        updated_at = now()
    WHERE id = _trip_id;

  IF _trip.reservation_id IS NOT NULL THEN
    UPDATE public.reservations
      SET archived_at = COALESCE(archived_at, now()),
          updated_at = now()
      WHERE id = _trip.reservation_id;
  END IF;

  UPDATE public.driver_positions
    SET archived_at = COALESCE(archived_at, now()),
        updated_at = now()
    WHERE trip_id = _trip_id;

  UPDATE public.client_positions
    SET archived_at = COALESCE(archived_at, now()),
        updated_at = now()
    WHERE trip_id = _trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_trip_and_reservation(uuid) TO authenticated;