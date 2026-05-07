-- 1. Allow chauffeurs to see pending unassigned VTC trips (the dispatch pool)
CREATE POLICY "Chauffeurs view pending VTC pool"
ON public.trips
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'chauffeur'::app_role)
  AND driver_id IS NULL
  AND status = 'pending'
  AND archived_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = trips.reservation_id
      AND r.service_type = 'VTC'::service_type
  )
);

-- 2. Atomic accept RPC for VTC trips
CREATE OR REPLACE FUNCTION public.accept_vtc_trip(_trip_id uuid)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.trips;
  _is_vtc boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT has_role(_uid, 'chauffeur'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Verify trip is VTC
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.reservations r ON r.id = t.reservation_id
    WHERE t.id = _trip_id AND r.service_type = 'VTC'::service_type
  ) INTO _is_vtc;

  IF NOT _is_vtc THEN
    RAISE EXCEPTION 'NOT_VTC_TRIP';
  END IF;

  -- Atomic assignment: only succeeds if still pending and unassigned
  UPDATE public.trips
     SET driver_id = _uid,
         status = 'assigned',
         updated_at = now()
   WHERE id = _trip_id
     AND driver_id IS NULL
     AND status = 'pending'
     AND archived_at IS NULL
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'ALREADY_TAKEN';
  END IF;

  RETURN _row;
END;
$$;

-- 3. Ensure trips table is in realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trips'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trips';
  END IF;
END $$;

ALTER TABLE public.trips REPLICA IDENTITY FULL;