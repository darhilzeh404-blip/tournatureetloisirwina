CREATE OR REPLACE FUNCTION public.admin_hard_delete(_table text, _ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'reservations','payments','circuits','offers','announcements',
    'partner_agencies','partner_tickets','partner_bookings','bus_trips',
    'bus_bookings','catalog_vehicles','catalog_vehicle_categories',
    'tourist_sites','profiles','drivers','buses','schools','school_routes',
    'transport_routes','transport_vehicles','vessels','boat_sailings',
    'train_routes','train_stations','moving_requests','flight_quote_requests',
    'vtc_recharge_requests','driver_withdrawals','trips','rides','group_rides',
    'user_notifications','client_error_logs','extra_activities','activity_partners'
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
$$;

REVOKE ALL ON FUNCTION public.admin_hard_delete(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete(text, uuid[]) TO authenticated;