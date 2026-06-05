
CREATE OR REPLACE FUNCTION public.is_group_ride_passenger(_user_id uuid, _ride_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_ride_passengers
    WHERE ride_id = _ride_id AND user_id = _user_id AND status <> 'cancelled'
  )
$$;

DROP POLICY IF EXISTS "Passengers view co-riders" ON public.group_ride_passengers;
CREATE POLICY "Passengers view co-riders"
  ON public.group_ride_passengers
  FOR SELECT
  TO authenticated
  USING (public.is_group_ride_passenger(auth.uid(), ride_id));
