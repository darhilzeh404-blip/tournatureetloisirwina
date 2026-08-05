GRANT SELECT ON public.bus_trips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_trips TO authenticated;
GRANT ALL ON public.bus_trips TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_bookings TO authenticated;
GRANT ALL ON public.bus_bookings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_booking_passengers TO authenticated;
GRANT ALL ON public.bus_booking_passengers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_final_tickets TO authenticated;
GRANT ALL ON public.bus_final_tickets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_parcel_requests TO authenticated;
GRANT ALL ON public.bus_parcel_requests TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_funeral_requests TO authenticated;
GRANT ALL ON public.bus_funeral_requests TO service_role;

GRANT SELECT ON public.buses TO authenticated;
GRANT ALL ON public.buses TO service_role;