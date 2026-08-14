ALTER TABLE public.boat_sailings DROP CONSTRAINT boat_sailings_vessel_id_fkey,
  ADD CONSTRAINT boat_sailings_vessel_id_fkey FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE CASCADE;

ALTER TABLE public.boat_sailings DROP CONSTRAINT boat_sailings_route_id_fkey,
  ADD CONSTRAINT boat_sailings_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.boat_routes(id) ON DELETE CASCADE;

ALTER TABLE public.bus_bookings DROP CONSTRAINT bus_bookings_trip_id_fkey,
  ADD CONSTRAINT bus_bookings_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.bus_trips(id) ON DELETE CASCADE;