CREATE OR REPLACE FUNCTION public.compute_reservation_amount(
  p_service_type service_type,
  p_details jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_package_id uuid;
  v_svc text;
  v_trip text;
  v_activity_id uuid;
  v_unit_price integer;
  v_partner_booking_id uuid;
  v_child_supplement numeric;
BEGIN
  -- 1. Forfaits / trajets / véhicules généraux (TransportBookingForm)
  v_package_id := (p_details->>'package_id')::uuid;
  IF v_package_id IS NOT NULL THEN
    SELECT price INTO v_amount FROM public.transport_packages WHERE id = v_package_id AND is_active;
    IF v_amount IS NOT NULL THEN
      IF lower(COALESCE(p_details->>'bus_type','')) = 'climatisee' THEN
        v_amount := round(v_amount * 1.8);
      END IF;
      RETURN v_amount;
    END IF;
  END IF;

  v_route_id := (p_details->>'route_id')::uuid;
  v_vehicle_id := (p_details->>'vehicle_id')::uuid;
  IF v_route_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_svc := lower(COALESCE(p_details->>'service_type', 'standard'));
    v_trip := lower(COALESCE(p_details->>'trip_type', 'aller_simple'));
    SELECT COALESCE(tp.price, tv.base_price) INTO v_amount
    FROM public.transport_vehicles tv
    LEFT JOIN public.transport_pricing tp
      ON tp.route_id = v_route_id
      AND tp.vehicle_id = v_vehicle_id
      AND lower(tp.service_type) = v_svc
      AND lower(tp.trip_type) = v_trip
    WHERE tv.id = v_vehicle_id;

    IF v_amount IS NOT NULL THEN
      -- supplément enfant
      v_children := COALESCE((p_details->>'children_count')::integer, 0);
      IF v_children > 0 THEN
        SELECT COALESCE(value, 0) INTO v_child_supplement FROM public.transport_settings WHERE key = 'child_supplement' LIMIT 1;
        v_amount := v_amount + (COALESCE(v_child_supplement, 0)::integer * v_children);
      END IF;

      -- activités extras
      IF jsonb_typeof(p_details->'activity_ids') = 'array' THEN
        FOR v_extra_id IN SELECT jsonb_array_elements_text(p_details->'activity_ids') LOOP
          SELECT COALESCE(price, 0) + COALESCE(registration_fee, 0) INTO v_extra_price
          FROM public.transport_activities WHERE id = v_extra_id::uuid;
          v_amount := v_amount + COALESCE(v_extra_price, 0);
        END LOOP;
      END IF;

      IF lower(COALESCE(p_details->>'bus_type','')) = 'climatisee' THEN
        v_amount := round(v_amount * 1.8);
      END IF;
      RETURN v_amount;
    END IF;
  END IF;

  -- BILLET (billets classiques, partenaires, réservations de navire)
  IF p_service_type = 'BILLET' THEN
    v_quantity := GREATEST(COALESCE((p_details->>'seats')::integer, (p_details->>'quantity')::integer, 1), 1);

    v_partner_booking_id := (p_details->>'partner_booking_id')::uuid;
    IF v_partner_booking_id IS NOT NULL THEN
      SELECT total_amount INTO v_amount
      FROM public.partner_bookings
      WHERE id = v_partner_booking_id
        AND (p_user_id IS NULL OR user_id = p_user_id);
      RETURN v_amount;
    END IF;

    v_ticket_id := (p_details->>'partner_ticket_id')::uuid;
    IF v_ticket_id IS NOT NULL THEN
      SELECT price INTO v_unit_price FROM public.partner_tickets WHERE id = v_ticket_id;
    ELSE
      v_ticket_id := (p_details->>'ticket_id')::uuid;
      IF v_ticket_id IS NOT NULL THEN
        SELECT price INTO v_unit_price FROM public.tickets WHERE id = v_ticket_id;
      END IF;
    END IF;

    IF v_unit_price IS NOT NULL THEN
      RETURN v_unit_price * v_quantity;
    END IF;
    RETURN NULL;
  END IF;

  -- CIRCUIT_TOURISTIQUE
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

  -- TRANSPORT_SCOLAIRE
  IF p_service_type = 'TRANSPORT_SCOLAIRE' THEN
    v_route_id := (p_details->>'school_route_id')::uuid;
    v_months := COALESCE((p_details->>'months')::integer, 1);
    v_children := COALESCE((p_details->>'children_count')::integer, 1);
    IF v_route_id IS NOT NULL THEN
      SELECT monthly_price INTO v_amount FROM public.school_routes WHERE id = v_route_id AND is_active;
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

  -- LOCATION_CATALOGUE
  IF p_service_type = 'LOCATION_CATALOGUE' THEN
    v_vehicle_id := (p_details->>'catalog_vehicle_id')::uuid;
    IF v_vehicle_id IS NULL THEN
      v_vehicle_id := (p_details->>'vehicle_id')::uuid;
    END IF;
    v_days := COALESCE((p_details->>'days')::integer, 1);
    v_qty := COALESCE((p_details->>'quantity')::integer, 1);
    IF v_vehicle_id IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT daily_rate INTO v_amount FROM public.catalog_vehicles WHERE id = v_vehicle_id;
    RETURN COALESCE(v_amount, 0) * v_days * v_qty;
  END IF;

  -- LOCATION_BUS
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_reservation_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_computed integer;
BEGIN
  v_computed := public.compute_reservation_amount(NEW.service_type, NEW.details, NEW.user_id);
  IF v_computed IS NOT NULL THEN
    NEW.total_amount := v_computed;
  END IF;
  RETURN NEW;
END;
$function$;

-- Renforcer l'isolation : les fonctions internes ne doivent pas être invoquées directement
REVOKE EXECUTE ON FUNCTION public.compute_reservation_amount(service_type, jsonb, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_reservation_amount() FROM public, anon, authenticated;