CREATE POLICY "Drivers can view payments for their VTC trips"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.trips t
    JOIN public.reservations r ON r.id = t.reservation_id
    WHERE t.reservation_id = payments.reservation_id
      AND t.driver_id = auth.uid()
      AND r.service_type = 'VTC'::service_type
  )
);