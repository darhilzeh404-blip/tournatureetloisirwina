CREATE TABLE public.vtc_fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_key text NOT NULL,
  category text NOT NULL,
  mode text NOT NULL,
  price integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vtc_fares TO authenticated;
GRANT ALL ON public.vtc_fares TO service_role;

ALTER TABLE public.vtc_fares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read VTC fares" ON public.vtc_fares
FOR SELECT TO authenticated USING (true);

INSERT INTO public.vtc_fares (zone_key, category, mode, price) VALUES
('akanda', 'standard', 'express', 2000),
('akanda', 'standard', 'hour', 5000),
('akanda', 'confort', 'express', 2600),
('akanda', 'confort', 'hour', 6500),
('akanda', 'vip', 'express', 5000),
('akanda', 'vip', 'hour', 10000),
('libreville', 'standard', 'express', 2000),
('libreville', 'standard', 'hour', 5000),
('libreville', 'confort', 'express', 2600),
('libreville', 'confort', 'hour', 6500),
('libreville', 'vip', 'express', 5000),
('libreville', 'vip', 'hour', 10000),
('owendo', 'standard', 'express', 2000),
('owendo', 'standard', 'hour', 5000),
('owendo', 'confort', 'express', 2600),
('owendo', 'confort', 'hour', 6500),
('owendo', 'vip', 'express', 5000),
('owendo', 'vip', 'hour', 10000),
('akanda-libreville', 'standard', 'express', 5000),
('akanda-libreville', 'standard', 'hour', 8000),
('akanda-libreville', 'confort', 'express', 6500),
('akanda-libreville', 'confort', 'hour', 10400),
('akanda-libreville', 'vip', 'express', 10000),
('akanda-libreville', 'vip', 'hour', 15000),
('akanda-owendo', 'standard', 'express', 8000),
('akanda-owendo', 'standard', 'hour', 10000),
('akanda-owendo', 'confort', 'express', 10400),
('akanda-owendo', 'confort', 'hour', 13000),
('akanda-owendo', 'vip', 'express', 15000),
('akanda-owendo', 'vip', 'hour', 20000),
('libreville-owendo', 'standard', 'express', 5000),
('libreville-owendo', 'standard', 'hour', 8000),
('libreville-owendo', 'confort', 'express', 6500),
('libreville-owendo', 'confort', 'hour', 10400),
('libreville-owendo', 'vip', 'express', 10000),
('libreville-owendo', 'vip', 'hour', 15000);

CREATE OR REPLACE FUNCTION public.compute_reservation_amount(p_service_type service_type, p_details jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount integer;
  v_ticket_id uuid;
  v_quantity integer;
  v_circuit_id uuid;
  v_persons integer;
  v_circuit circuits%ROWTYPE;
  v_extra jsonb;
  v_extra_id uuid;
  v_extra_price integer;
  v_route_id uuid;
  v_months integer;
  v_children integer;
  v_route_label text;
  v_standing text;
  v_formule text;
  v_school_amount integer;
  v_vehicle_id uuid;
  v_days integer;
  v_qty integer;
  v_capacity text;
  v_capacity_num integer;
  v_factor numeric;
  v_event_amount integer;
  v_from_zone text;
  v_to_zone text;
  v_zone_key text;
  v_category text;
  v_mode text;
  v_billable_hours integer;
  v_fare_price integer;
  v_extra_total integer;
  v_fee integer;
  v_total_passengers integer;
  v_per_passenger integer;
  v_pickup_fee integer;
  v_activite_label text;
BEGIN
  -- Billets partenaires
  IF p_service_type = 'BILLET' THEN
    v_ticket_id := (p_details->>'ticket_id')::uuid;
    v_quantity := COALESCE((p_details->>'quantity')::integer, 1);
    IF v_ticket_id IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT price INTO v_amount FROM public.partner_tickets WHERE id = v_ticket_id;
    RETURN COALESCE(v_amount, 0) * v_quantity;
  END IF;

  -- Circuits touristiques
  IF p_service_type = 'CIRCUIT_TOURISTIQUE' THEN
    v_persons := COALESCE((p_details->>'persons')::integer, 1);
    v_circuit_id := (p_details->>'circuit_id')::uuid;
    IF v_circuit_id IS NULL AND p_details->>'circuit' IS NOT NULL THEN
      SELECT * INTO v_circuit FROM public.circuits WHERE nom = p_details->>'circuit' LIMIT 1;
    ELSIF v_circuit_id IS NOT NULL THEN
      SELECT * INTO v_circuit FROM public.circuits WHERE id = v_circuit_id;
    END IF;
    IF v_circuit.id IS NULL THEN
      RETURN NULL;
    END IF;
    v_amount := COALESCE(v_circuit.base_price, 0) * v_persons;
    IF COALESCE((p_details->>'wants_lodging')::boolean, v_circuit.includes_lodging) THEN
      v_amount := v_amount + COALESCE(v_circuit.lodging_price, 0) * v_persons;
    END IF;
    IF COALESCE((p_details->>'wants_guide')::boolean, v_circuit.includes_guide) THEN
      v_amount := v_amount + COALESCE(v_circuit.guide_price, 0);
    END IF;
    IF jsonb_typeof(p_details->'extras') = 'array' THEN
      FOR v_extra IN SELECT jsonb_array_elements(p_details->'extras') LOOP
        v_extra_id := (v_extra->>'id')::uuid;
        IF v_extra_id IS NULL THEN
          v_extra_price := COALESCE((v_extra->>'price')::integer, 0);
        ELSE
          SELECT COALESCE(price, 0) INTO v_extra_price
          FROM public.circuit_activities
          WHERE id = v_extra_id AND circuit_id = v_circuit.id
          LIMIT 1;
        END IF;
        v_amount := v_amount + (COALESCE(v_extra_price, 0) * v_persons);
      END LOOP;
    END IF;
    RETURN v_amount;
  END IF;

  -- Transport scolaire
  IF p_service_type = 'TRANSPORT_SCOLAIRE' THEN
    v_route_id := (p_details->>'school_route_id')::uuid;
    v_months := COALESCE((p_details->>'months')::integer, 1);
    v_children := COALESCE((p_details->>'children_count')::integer, 1);
    IF v_route_id IS NOT NULL THEN
      SELECT monthly_price INTO v_amount FROM public.school_routes WHERE id = v_route_id;
      IF v_amount IS NOT NULL THEN
        RETURN v_amount * v_months * v_children;
      END IF;
    END IF;
    v_route_label := p_details->>'route_label';
    v_standing := lower(COALESCE(p_details->>'standing', 'standard'));
    v_formule := lower(COALESCE(p_details->>'formule', 'simple'));
    IF v_route_label IS NOT NULL THEN
      SELECT amount INTO v_school_amount FROM public.school_trip_tariffs
      WHERE route_label = v_route_label AND standing = v_standing AND formule = v_formule
      LIMIT 1;
      IF v_school_amount IS NOT NULL THEN
        RETURN v_school_amount * COALESCE((p_details->>'months')::integer, 1) * COALESCE((p_details->>'children_count')::integer, 1);
      END IF;
    END IF;
    IF v_formule IN ('simple', 'ar') THEN
      SELECT amount INTO v_school_amount FROM public.school_monthly_tariffs
      WHERE standing = v_standing AND formule = v_formule
      LIMIT 1;
      IF v_school_amount IS NOT NULL THEN
        RETURN v_school_amount * COALESCE((p_details->>'nb_enfants')::integer, 1);
      END IF;
    END IF;
    IF v_formule = 'extra-scolaire' OR p_details->>'formule' = 'Extra-scolaire' THEN
      v_extra_total := 0;
      IF jsonb_typeof(p_details->'activites') = 'array' THEN
        FOR v_activite_label IN SELECT jsonb_array_elements_text(p_details->'activites') LOOP
          SELECT COALESCE(price, 0) INTO v_extra_price
          FROM public.extra_activities WHERE label = v_activite_label LIMIT 1;
          v_extra_total := v_extra_total + COALESCE(v_extra_price, 0);
        END LOOP;
      END IF;
      v_fee := COALESCE((p_details->>'frais_transport')::integer, 0);
      RETURN v_extra_total + v_fee * COALESCE((p_details->>'nb_enfants')::integer, 1);
    END IF;
    RETURN NULL;
  END IF;

  -- Location de véhicules du catalogue
  IF p_service_type = 'LOCATION_CATALOGUE' THEN
    v_vehicle_id := (p_details->>'catalog_vehicle_id')::uuid;
    v_days := COALESCE((p_details->>'days')::integer, 1);
    v_qty := COALESCE((p_details->>'quantity')::integer, 1);
    IF v_vehicle_id IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT daily_rate INTO v_amount FROM public.catalog_vehicles WHERE id = v_vehicle_id;
    RETURN COALESCE(v_amount, 0) * v_days * v_qty;
  END IF;

  -- Location de bus
  IF p_service_type = 'LOCATION_BUS' THEN
    IF p_details->>'type_location' = 'Événementiel' THEN
      v_standing := lower(COALESCE(p_details->>'standing', 'standard'));
      v_formule := CASE WHEN lower(COALESCE(p_details->>'formule','')) LIKE '%demi%' THEN 'demi' ELSE 'journee' END;
      SELECT amount INTO v_event_amount FROM public.event_bus_tariffs
      WHERE standing = v_standing AND formule = v_formule LIMIT 1;
      IF v_event_amount IS NULL THEN
        RETURN NULL;
      END IF;
      v_capacity := COALESCE(p_details->>'capacite', '1');
      v_capacity_num := (regexp_match(v_capacity, '([0-9]+)'))[1]::integer;
      SELECT factor INTO v_factor FROM public.event_bus_capacity_factors WHERE capacity = v_capacity_num LIMIT 1;
      RETURN round(v_event_amount * COALESCE(v_factor, 1));
    END IF;
    v_amount := COALESCE((p_details->>'tarif_unitaire')::integer, 0);
    v_days := COALESCE((p_details->>'jours')::integer, 1);
    v_total_passengers := COALESCE((p_details->>'nb_personnes')::integer, 1);
    RETURN v_amount * v_days * v_total_passengers;
  END IF;

  -- VTC
  IF p_service_type = 'VTC' THEN
    v_from_zone := COALESCE(p_details->'pickup'->>'zone', p_details->>'from_zone');
    v_to_zone := COALESCE(p_details->'destination'->>'zone', p_details->>'to_zone');
    IF v_from_zone IS NULL OR v_to_zone IS NULL THEN
      IF p_details->>'estimated_total' IS NOT NULL THEN
        RETURN (p_details->>'estimated_total')::integer;
      END IF;
      RETURN NULL;
    END IF;
    SELECT string_agg(zone, '-' ORDER BY zone) INTO v_zone_key
    FROM (SELECT unnest(ARRAY[v_from_zone, v_to_zone]) AS zone) sub;
    v_category := lower(COALESCE(p_details->>'category', 'standard'));
    v_mode := lower(COALESCE(p_details->>'mode', 'express'));
    SELECT price INTO v_fare_price FROM public.vtc_fares
    WHERE zone_key = v_zone_key AND category = v_category AND mode = v_mode
    LIMIT 1;
    IF v_fare_price IS NULL AND v_from_zone = v_to_zone THEN
      SELECT price INTO v_fare_price FROM public.vtc_fares
      WHERE zone_key = v_from_zone AND category = v_category AND mode = v_mode
      LIMIT 1;
    END IF;
    IF v_fare_price IS NULL THEN
      IF p_details->>'estimated_total' IS NOT NULL THEN
        RETURN (p_details->>'estimated_total')::integer;
      END IF;
      RETURN NULL;
    END IF;
    v_billable_hours := COALESCE((p_details->>'billable_hours')::integer, 1);
    RETURN v_fare_price * v_billable_hours;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_reservation_amount(service_type, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_reservation_amount(service_type, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_reservation_amount(service_type, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_reservation_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computed integer;
BEGIN
  v_computed := public.compute_reservation_amount(NEW.service_type, NEW.details);
  IF v_computed IS NOT NULL THEN
    NEW.total_amount := v_computed;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_reservation_amount() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_reservation_amount() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_reservation_amount() TO service_role;

DROP TRIGGER IF EXISTS reservations_enforce_amount ON public.reservations;
CREATE TRIGGER reservations_enforce_amount
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_reservation_amount();
