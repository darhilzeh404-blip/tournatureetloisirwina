CREATE POLICY "Clients can create own pending VTC trips"
ON public.trips
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = client_id
  AND driver_id IS NULL
  AND status = 'pending'
  AND archived_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.id = reservation_id
      AND r.user_id = auth.uid()
      AND r.service_type = 'VTC'::service_type
      AND r.archived_at IS NULL
  )
);