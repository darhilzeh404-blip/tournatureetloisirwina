REVOKE EXECUTE ON FUNCTION public.credit_driver_earnings(uuid, uuid, uuid, integer, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, jsonb) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, jsonb) FROM authenticated, anon, PUBLIC;

CREATE OR REPLACE FUNCTION public.driver_near_pending_trip(_lat numeric, _lng numeric, _created_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _created_at > now() - interval '3 hours'
     AND EXISTS (
       SELECT 1
       FROM public.driver_positions dp
       WHERE dp.driver_id = auth.uid()
         AND dp.updated_at > now() - interval '60 minutes'
         AND _lat IS NOT NULL AND _lng IS NOT NULL
         AND (
           6371 * acos(
             LEAST(1, GREATEST(-1,
               cos(radians(dp.latitude::float8)) * cos(radians(_lat::float8))
               * cos(radians(_lng::float8) - radians(dp.longitude::float8))
               + sin(radians(dp.latitude::float8)) * sin(radians(_lat::float8))
             ))
           )
         ) <= 10
     );
$$;

REVOKE EXECUTE ON FUNCTION public.driver_near_pending_trip(numeric, numeric, timestamptz) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_near_pending_trip(numeric, numeric, timestamptz) TO authenticated;

DROP POLICY IF EXISTS "Chauffeurs view pending VTC pool" ON public.trips;
CREATE POLICY "Chauffeurs view pending VTC pool"
ON public.trips
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'chauffeur'::app_role)
  AND driver_id IS NULL
  AND status = 'pending'
  AND archived_at IS NULL
  AND is_vtc_reservation(reservation_id)
  AND public.driver_near_pending_trip(origin_lat, origin_lng, created_at)
);