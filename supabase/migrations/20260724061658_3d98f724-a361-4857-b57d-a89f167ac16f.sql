
-- Lock down columns non-admin roles can modify on group_rides, rides, trips

-- group_rides: when driver claims/updates a ride, block changes to pricing & capacity fields
CREATE OR REPLACE FUNCTION public.prevent_group_rides_driver_field_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerant') THEN
    RETURN NEW;
  END IF;
  IF NEW.price_per_seat IS DISTINCT FROM OLD.price_per_seat
     OR NEW.max_seats IS DISTINCT FROM OLD.max_seats
     OR NEW.seats_taken IS DISTINCT FROM OLD.seats_taken
     OR NEW.route_id IS DISTINCT FROM OLD.route_id
     OR NEW.communes_count IS DISTINCT FROM OLD.communes_count
     OR NEW.signature IS DISTINCT FROM OLD.signature
     OR NEW.departure_deadline IS DISTINCT FROM OLD.departure_deadline
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Drivers cannot modify pricing, capacity, or route fields on group_rides';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_group_rides_driver_tamper ON public.group_rides;
CREATE TRIGGER trg_prevent_group_rides_driver_tamper
BEFORE UPDATE ON public.group_rides
FOR EACH ROW EXECUTE FUNCTION public.prevent_group_rides_driver_field_tampering();

-- rides: chauffeurs may only update status/driver_id
CREATE OR REPLACE FUNCTION public.prevent_rides_chauffeur_field_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerant') THEN
    RETURN NEW;
  END IF;
  IF NEW.pickup IS DISTINCT FROM OLD.pickup
     OR NEW.destination IS DISTINCT FROM OLD.destination
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Chauffeurs cannot modify pickup, destination, price, or booking fields on rides';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_rides_chauffeur_tamper ON public.rides;
CREATE TRIGGER trg_prevent_rides_chauffeur_tamper
BEFORE UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.prevent_rides_chauffeur_field_tampering();

-- trips: gerants may only update status/eta/driver assignment/timestamps
CREATE OR REPLACE FUNCTION public.prevent_trips_gerant_field_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.origin_address IS DISTINCT FROM OLD.origin_address
     OR NEW.origin_lat IS DISTINCT FROM OLD.origin_lat
     OR NEW.origin_lng IS DISTINCT FROM OLD.origin_lng
     OR NEW.destination_address IS DISTINCT FROM OLD.destination_address
     OR NEW.destination_lat IS DISTINCT FROM OLD.destination_lat
     OR NEW.destination_lng IS DISTINCT FROM OLD.destination_lng
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only admins can modify booking, route, or category fields on trips';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_trips_gerant_tamper ON public.trips;
CREATE TRIGGER trg_prevent_trips_gerant_tamper
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.prevent_trips_gerant_field_tampering();
