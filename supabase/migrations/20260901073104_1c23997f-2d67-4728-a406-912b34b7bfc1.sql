-- 1. Formule officielle unique (source de vérité)
CREATE OR REPLACE FUNCTION public.normalize_school_trip_type(p_trip_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN regexp_replace(lower(trim(coalesce(p_trip_type, 'aller_retour'))), '[^a-z]+', '_', 'g')
         IN ('aller_simple','retour_simple','simple','aller','retour','one_way','allersimple','retoursimple')
      THEN 'aller_simple'
    ELSE 'aller_retour'
  END
$$;

CREATE OR REPLACE FUNCTION public.school_transport_amount(
  p_monthly_price integer,
  p_trip_type text,
  p_months integer,
  p_children integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
           WHEN public.normalize_school_trip_type(p_trip_type) = 'aller_simple'
             THEN floor(coalesce(p_monthly_price, 0)::numeric / 2)::integer + 10000
           ELSE coalesce(p_monthly_price, 0)
         END
         * GREATEST(1, LEAST(24, coalesce(p_months, 1)))
         * GREATEST(1, LEAST(20, coalesce(p_children, 1)))
$$;

REVOKE ALL ON FUNCTION public.normalize_school_trip_type(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_transport_amount(integer, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_school_trip_type(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.school_transport_amount(integer, text, integer, integer) TO authenticated, service_role;

-- 2. compute_reservation_amount : brancher la formule unique (sans réécrire le reste)
DO $do$
DECLARE
  def text;
  newdef text;
  r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'compute_reservation_amount'
  LOOP
    def := pg_get_functiondef(r.oid);
    newdef := regexp_replace(
      def,
      'IF lower\(COALESCE\(p_details->>''trip_type'', ''aller_retour''\)\)[\s\S]*?RETURN v_amount \* v_months \* v_children;',
      'RETURN public.school_transport_amount(v_amount, p_details->>''trip_type'', v_months, v_children);',
      'g'
    );
    IF newdef = def THEN
      RAISE EXCEPTION 'Bloc scolaire introuvable dans compute_reservation_amount (oid %)', r.oid;
    END IF;
    EXECUTE newdef;
  END LOOP;
END
$do$;

-- 3. Trigger anti-fraude : même formule, même normalisation
CREATE OR REPLACE FUNCTION public.validate_reservation_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _expected integer;
  _tid uuid;
  _pid uuid;
  _cid uuid;
  _seats int;
  _persons int;
  _unit int;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount
       OR NEW.service_type IS DISTINCT FROM OLD.service_type
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'FORBIDDEN_FIELD_UPDATE';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.total_amount IS NULL OR NEW.total_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL_AMOUNT';
  END IF;

  IF NEW.service_type = 'BILLET'::service_type THEN
    _tid := NULLIF(NEW.details->>'ticket_id','')::uuid;
    _pid := NULLIF(NEW.details->>'partner_ticket_id','')::uuid;
    _seats := GREATEST(COALESCE((NEW.details->>'seats')::int, (NEW.details->>'quantity')::int, 1), 1);
    IF _pid IS NOT NULL THEN
      SELECT price INTO _unit FROM public.partner_tickets WHERE id = _pid;
    ELSIF _tid IS NOT NULL THEN
      SELECT price INTO _unit FROM public.tickets WHERE id = _tid;
    END IF;
    IF _unit IS NOT NULL THEN
      _expected := _unit * _seats;
      IF NEW.total_amount <> _expected THEN
        RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_BILLET: expected %, got %', _expected, NEW.total_amount;
      END IF;
    END IF;

  ELSIF NEW.service_type = 'CIRCUIT_TOURISTIQUE'::service_type THEN
    _cid := NULLIF(NEW.details->>'circuit_id','')::uuid;
    _persons := GREATEST(COALESCE((NEW.details->>'persons')::int, (NEW.details->>'nb_personnes')::int, (NEW.details->>'quantity')::int, 1), 1);
    IF _cid IS NOT NULL THEN
      SELECT base_price INTO _unit FROM public.circuits WHERE id = _cid;
      IF _unit IS NOT NULL THEN
        _expected := _unit * _persons;
        IF NEW.total_amount < _expected THEN
          RAISE EXCEPTION 'TOTAL_AMOUNT_BELOW_MIN_CIRCUIT: min %, got %', _expected, NEW.total_amount;
        END IF;
      END IF;
    END IF;

  ELSIF NEW.service_type = 'TRANSPORT_SCOLAIRE'::service_type THEN
    DECLARE
      _srid uuid := NULLIF(NEW.details->>'school_route_id','')::uuid;
      _months int := GREATEST(COALESCE((NEW.details->>'months')::int, 1), 1);
      _kids int := GREATEST(COALESCE((NEW.details->>'children_count')::int, 1), 1);
    BEGIN
      IF _srid IS NOT NULL THEN
        SELECT monthly_price INTO _unit FROM public.school_routes WHERE id = _srid AND is_active;
        IF _unit IS NULL THEN
          RAISE EXCEPTION 'INVALID_SCHOOL_ROUTE';
        END IF;
        _expected := public.school_transport_amount(_unit, NEW.details->>'trip_type', _months, _kids);
        IF NEW.total_amount <> _expected THEN
          RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_SCOLAIRE: expected %, got %', _expected, NEW.total_amount;
        END IF;
      END IF;
    END;

  ELSIF NEW.service_type = 'LOCATION_CATALOGUE'::service_type THEN
    DECLARE
      _vid uuid := NULLIF(NEW.details->>'vehicle_id','')::uuid;
      _days int := GREATEST(COALESCE((NEW.details->>'days')::int, 1), 1);
      _qty int := GREATEST(COALESCE((NEW.details->>'quantity')::int, 1), 1);
    BEGIN
      IF _vid IS NOT NULL THEN
        SELECT daily_rate INTO _unit FROM public.catalog_vehicles WHERE id = _vid;
        IF _unit IS NOT NULL THEN
          _expected := _unit * _days * _qty;
          IF NEW.total_amount <> _expected THEN
            RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH_CATALOGUE: expected %, got %', _expected, NEW.total_amount;
          END IF;
        END IF;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Immutabilité stricte des montants
CREATE OR REPLACE FUNCTION public.enforce_payment_amount_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_IMMUTABLE';
  END IF;

  IF NEW.status = 'VALIDATED'::payment_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT total_amount INTO v_total FROM public.reservations WHERE id = NEW.reservation_id;
    IF v_total IS NULL THEN
      RAISE EXCEPTION 'Réservation introuvable';
    END IF;
    IF NEW.amount > v_total THEN
      RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH: paiement % > total réservation %', NEW.amount, v_total;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_payment_amount_immutable ON public.payments;
CREATE TRIGGER trg_payment_amount_immutable
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_amount_immutable();

CREATE OR REPLACE FUNCTION public.enforce_reservation_total_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
     AND EXISTS (
       SELECT 1 FROM public.payments
       WHERE reservation_id = OLD.id
         AND status IN ('PENDING'::payment_status, 'VALIDATED'::payment_status)
     ) THEN
    RAISE EXCEPTION 'RESERVATION_TOTAL_LOCKED: un paiement existe déjà pour cette réservation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reservation_total_locked ON public.reservations;
CREATE TRIGGER trg_reservation_total_locked
BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.enforce_reservation_total_locked();

-- 5. Suppression définitive : couvrir toutes les sections admin
CREATE OR REPLACE FUNCTION public.admin_hard_delete(_table text, _ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allowed text[] := ARRAY[
    'reservations','payments','circuits','circuit_activities','offers','announcements',
    'partner_agencies','partner_tickets','partner_bookings','partner_ticket_codes',
    'bus_trips','bus_bookings','bus_final_tickets','bus_parcel_requests','bus_funeral_requests',
    'buses','group_bus_trips','group_routes','group_rides','group_ride_passengers',
    'catalog_vehicles','catalog_vehicle_categories','tourist_sites','profiles','drivers',
    'schools','school_routes','school_trip_tariffs','school_monthly_tariffs',
    'transport_routes','transport_vehicles','transport_activities','transport_categories',
    'transport_packages','transport_pricing','vehicle_types','activity_partners','extra_activities',
    'vessels','vessel_services','boat_routes','boat_sailings',
    'train_routes','train_stations','train_types','train_travel_classes','train_ticket_classes',
    'train_route_stations','train_discount_rules','train_baggage_rules',
    'tickets','ticket_categories','moving_requests','moving_quotes',
    'flight_programs','flight_quote_requests','flight_quote_offers',
    'vtc_recharge_requests','vtc_fares','driver_withdrawals','driver_wallet_transactions',
    'trips','rides','user_notifications','agency_notifications','client_error_logs',
    'wina_gifts','wina_lotteries','wina_gift_redemptions','vip_levels','application_fees',
    'audit_logs','user_roles'
  ];
  deleted integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _table IS NULL OR NOT (_table = ANY(allowed)) THEN
    RAISE EXCEPTION 'Table non autorisée: %', _table;
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = ANY($1)', _table) USING _ids;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_hard_delete(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete(text, uuid[]) TO authenticated;