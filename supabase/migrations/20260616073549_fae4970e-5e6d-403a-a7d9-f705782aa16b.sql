
CREATE OR REPLACE FUNCTION public.is_group_ride_driver(_user_id uuid, _ride_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_rides
    WHERE id = _ride_id AND driver_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_ride_driver(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_ride_driver(uuid, uuid) TO authenticated;

-- Break recursion: replace cross-referencing policies with SECURITY DEFINER calls
DROP POLICY IF EXISTS "Passengers view their ride" ON public.group_rides;
CREATE POLICY "Passengers view their ride"
  ON public.group_rides
  FOR SELECT
  USING (public.is_group_ride_passenger(auth.uid(), id));

DROP POLICY IF EXISTS "Drivers see passengers of their ride" ON public.group_ride_passengers;
CREATE POLICY "Drivers see passengers of their ride"
  ON public.group_ride_passengers
  FOR SELECT
  USING (public.is_group_ride_driver(auth.uid(), ride_id));
