CREATE OR REPLACE FUNCTION public.sync_partner_ticket_category_from_agency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _slug text;
  _cat_id uuid;
BEGIN
  SELECT a.category::text INTO _slug
  FROM public.partner_agencies a
  WHERE a.id = NEW.agency_id;

  IF _slug IS NOT NULL THEN
    SELECT c.id INTO _cat_id FROM public.ticket_categories c WHERE c.slug = _slug LIMIT 1;
    IF _cat_id IS NOT NULL THEN
      NEW.category_id := _cat_id;
      NEW.transport_mode := _slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_tickets_sync_category ON public.partner_tickets;
CREATE TRIGGER partner_tickets_sync_category
BEFORE INSERT OR UPDATE OF agency_id, category_id, transport_mode ON public.partner_tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_partner_ticket_category_from_agency();