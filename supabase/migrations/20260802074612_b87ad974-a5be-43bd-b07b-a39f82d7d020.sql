CREATE OR REPLACE FUNCTION public.fqr_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.flight_quote_events(request_id, actor_id, action, to_status, details)
  VALUES (NEW.id, NEW.user_id, 'request_created', NEW.status,
          jsonb_build_object('origin', NEW.origin, 'destination', NEW.destination, 'departure_date', NEW.departure_date));

  PERFORM public.notify_admins(
    'flight_request_new',
    'Nouvelle demande de vol ' || NEW.request_number,
    NEW.contact_name || ' — ' || NEW.origin || ' → ' || NEW.destination,
    '/admin/vols-demandes',
    jsonb_build_object('request_id', NEW.id));

  PERFORM public.notify_user(
    NEW.user_id,
    'flight_request_sent',
    'Demande envoyée',
    'Demande ' || NEW.request_number || ' — ' || NEW.origin || ' → ' || NEW.destination || '. Vous recevrez une offre tarifaire.',
    '/mes-demandes-vols/' || NEW.id,
    jsonb_build_object('request_id', NEW.id));

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_self(_type text, _title text, _message text, _link text DEFAULT NULL, _payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_notifications(user_id, type, title, message, link, payload)
  VALUES (auth.uid(), left(coalesce(_type,'info'), 60), left(coalesce(_title,'Notification'), 160), left(coalesce(_message,''), 500), left(_link, 300), coalesce(_payload, '{}'::jsonb));
END; $function$;

REVOKE ALL ON FUNCTION public.notify_self(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_self(text, text, text, text, jsonb) TO authenticated;