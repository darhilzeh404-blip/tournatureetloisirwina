
-- Narrow driver visibility on client_positions to assigned/active trips only (exclude pending)
DROP POLICY IF EXISTS "Driver views assigned client position" ON public.client_positions;
CREATE POLICY "Driver views assigned client position"
ON public.client_positions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.client_id = client_positions.client_id
      AND t.driver_id = auth.uid()
      AND t.status IN ('assigned','active')
      AND t.archived_at IS NULL
  )
);

-- Stop broadcasting group_ride_passengers PII over Realtime.
-- RLS restricts SELECT to the passenger's own row, and drivers access passenger info
-- through SECURITY DEFINER RPCs (get_group_ride_passengers_for_driver) that project
-- only the fields they need. Realtime is not required here.
ALTER PUBLICATION supabase_realtime DROP TABLE public.group_ride_passengers;
