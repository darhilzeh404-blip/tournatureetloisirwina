
-- Realtime
ALTER TABLE public.group_rides REPLICA IDENTITY FULL;
ALTER TABLE public.group_ride_passengers REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='group_rides';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_rides'; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='group_ride_passengers';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_ride_passengers'; END IF;
END $$;

-- Atomic join-or-create RPC (bypasses RLS via SECURITY DEFINER, but enforces auth + own user_id).
CREATE OR REPLACE FUNCTION public.join_group_ride(
  _signature text,
  _communes_count smallint,
  _price_per_seat integer,
  _wait_minutes integer,
  _max_seats smallint,
  _pickup_address text,
  _pickup_lat numeric,
  _pickup_lng numeric,
  _destination_address text,
  _destination_lat numeric,
  _destination_lng numeric,
  _commune_pickup text,
  _commune_destination text
) RETURNS TABLE(ride_id uuid, seat_index smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ride public.group_rides;
  _seat smallint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  -- Prevent double-booking on same active ride
  IF EXISTS (
    SELECT 1 FROM public.group_ride_passengers p
    JOIN public.group_rides r ON r.id = p.ride_id
    WHERE p.user_id = _uid
      AND p.status <> 'cancelled'
      AND r.status IN ('searching','matched','driver_arriving','active')
      AND r.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ALREADY_IN_RIDE';
  END IF;

  -- Try to find and lock a compatible searching ride with a free seat
  SELECT * INTO _ride
  FROM public.group_rides
  WHERE status = 'searching'
    AND signature = _signature
    AND seats_taken < max_seats
    AND departure_deadline > now()
    AND archived_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _ride.id IS NULL THEN
    INSERT INTO public.group_rides (
      status, communes_count, price_per_seat, max_seats, seats_taken,
      departure_deadline, signature
    ) VALUES (
      'searching', _communes_count, _price_per_seat, _max_seats, 1,
      now() + (_wait_minutes || ' minutes')::interval, _signature
    ) RETURNING * INTO _ride;
    _seat := 1;
  ELSE
    _seat := _ride.seats_taken + 1;
    UPDATE public.group_rides
       SET seats_taken = _seat,
           status = CASE WHEN _seat >= max_seats THEN 'matched' ELSE status END,
           updated_at = now()
     WHERE id = _ride.id;
  END IF;

  INSERT INTO public.group_ride_passengers (
    ride_id, user_id, pickup_address, pickup_lat, pickup_lng,
    destination_address, destination_lat, destination_lng,
    commune_pickup, commune_destination, seat_index, status
  ) VALUES (
    _ride.id, _uid, _pickup_address, _pickup_lat, _pickup_lng,
    _destination_address, _destination_lat, _destination_lng,
    _commune_pickup, _commune_destination, _seat, 'matched'
  );

  ride_id := _ride.id;
  seat_index := _seat;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.join_group_ride(text, smallint, integer, integer, smallint, text, numeric, numeric, text, numeric, numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_group_ride(text, smallint, integer, integer, smallint, text, numeric, numeric, text, numeric, numeric, text, text) TO authenticated;
