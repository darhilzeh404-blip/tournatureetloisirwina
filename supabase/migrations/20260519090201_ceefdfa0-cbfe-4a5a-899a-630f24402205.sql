
-- 1. group_routes : corridors créés par l'admin
CREATE TABLE public.group_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  origin_commune text NOT NULL,
  destination_commune text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. group_rides : une course groupée (slot véhicule)
CREATE TABLE public.group_rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.group_routes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'searching'
    CHECK (status IN ('searching','matched','driver_arriving','active','completed','cancelled')),
  communes_count smallint NOT NULL DEFAULT 1 CHECK (communes_count BETWEEN 1 AND 3),
  price_per_seat integer NOT NULL DEFAULT 1500,
  max_seats smallint NOT NULL DEFAULT 3 CHECK (max_seats BETWEEN 1 AND 3),
  seats_taken smallint NOT NULL DEFAULT 0,
  departure_deadline timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  driver_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_rides_status ON public.group_rides(status) WHERE archived_at IS NULL;
CREATE INDEX idx_group_rides_signature ON public.group_rides(signature) WHERE status = 'searching';
CREATE INDEX idx_group_rides_driver ON public.group_rides(driver_id);

-- 3. group_ride_passengers
CREATE TABLE public.group_ride_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.group_rides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pickup_address text NOT NULL,
  pickup_lat numeric NOT NULL,
  pickup_lng numeric NOT NULL,
  destination_address text NOT NULL,
  destination_lat numeric NOT NULL,
  destination_lng numeric NOT NULL,
  commune_pickup text NOT NULL,
  commune_destination text NOT NULL,
  seat_index smallint NOT NULL,
  status text NOT NULL DEFAULT 'matched'
    CHECK (status IN ('matched','cancelled','completed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, user_id),
  UNIQUE (ride_id, seat_index)
);
CREATE INDEX idx_grp_pax_user ON public.group_ride_passengers(user_id);
CREATE INDEX idx_grp_pax_ride ON public.group_ride_passengers(ride_id);

-- 4. group_ride_payments
CREATE TABLE public.group_ride_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.group_rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.group_ride_passengers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  method text NOT NULL DEFAULT 'Mobile Money',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VALIDATED','REJECTED')),
  transaction_ref text,
  receipt_url text,
  admin_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_grp_pay_user ON public.group_ride_payments(user_id);
CREATE INDEX idx_grp_pay_ride ON public.group_ride_payments(ride_id);

-- 5. group_ride_status_history
CREATE TABLE public.group_ride_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.group_rides(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_grp_hist_ride ON public.group_ride_status_history(ride_id);

-- updated_at triggers
CREATE TRIGGER trg_group_routes_updated BEFORE UPDATE ON public.group_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_group_rides_updated BEFORE UPDATE ON public.group_rides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_group_payments_updated BEFORE UPDATE ON public.group_ride_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.group_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_ride_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_ride_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_ride_status_history ENABLE ROW LEVEL SECURITY;

-- group_routes : public read (active), admin full
CREATE POLICY "Anyone can view active group_routes" ON public.group_routes
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage group_routes" ON public.group_routes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- group_rides
CREATE POLICY "Admins full access group_rides" ON public.group_rides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Drivers view pool searching rides" ON public.group_rides
  FOR SELECT USING (
    public.has_role(auth.uid(), 'chauffeur'::app_role)
    AND (driver_id = auth.uid() OR (driver_id IS NULL AND status IN ('searching','matched')))
  );
CREATE POLICY "Drivers accept available rides" ON public.group_rides
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'chauffeur'::app_role)
    AND (driver_id IS NULL OR driver_id = auth.uid())
  );
CREATE POLICY "Passengers view their ride" ON public.group_rides
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_ride_passengers p
            WHERE p.ride_id = group_rides.id AND p.user_id = auth.uid())
  );
CREATE POLICY "Authenticated create group_rides" ON public.group_rides
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- group_ride_passengers
CREATE POLICY "Admins full passengers" ON public.group_ride_passengers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own passenger row" ON public.group_ride_passengers
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users see co-passengers of their ride" ON public.group_ride_passengers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_ride_passengers me
            WHERE me.ride_id = group_ride_passengers.ride_id AND me.user_id = auth.uid())
  );
CREATE POLICY "Drivers see passengers of their ride" ON public.group_ride_passengers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_rides r
            WHERE r.id = group_ride_passengers.ride_id AND r.driver_id = auth.uid())
  );
CREATE POLICY "Users insert own passenger row" ON public.group_ride_passengers
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own passenger row" ON public.group_ride_passengers
  FOR UPDATE USING (user_id = auth.uid());

-- group_ride_payments
CREATE POLICY "Admins manage payments" ON public.group_ride_payments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own group payments" ON public.group_ride_payments
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create own group payments" ON public.group_ride_payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- status history
CREATE POLICY "Admins view history" ON public.group_ride_status_history
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view history" ON public.group_ride_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_ride_passengers p
            WHERE p.ride_id = group_ride_status_history.ride_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_rides r
               WHERE r.id = group_ride_status_history.ride_id AND r.driver_id = auth.uid())
  );
CREATE POLICY "System insert history" ON public.group_ride_status_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_ride_passengers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_ride_status_history;
ALTER TABLE public.group_rides REPLICA IDENTITY FULL;
ALTER TABLE public.group_ride_passengers REPLICA IDENTITY FULL;
