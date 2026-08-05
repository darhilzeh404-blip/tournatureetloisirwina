CREATE OR REPLACE FUNCTION public.gerant_has_circuit_named(_user_id uuid, _name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_circuits uc
    JOIN public.circuits c ON c.id = uc.circuit_id
    WHERE uc.user_id = _user_id AND _name IS NOT NULL AND c.nom = _name
  )
$function$;

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
        _expected := _unit * _months * _kids;
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