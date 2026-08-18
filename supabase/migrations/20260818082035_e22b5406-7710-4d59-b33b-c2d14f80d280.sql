CREATE OR REPLACE FUNCTION public.validate_group_ride_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cur_status text;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT status INTO cur_status FROM public.group_rides WHERE id = NEW.ride_id;
  IF cur_status IS NULL THEN
    RAISE EXCEPTION 'RIDE_NOT_FOUND';
  END IF;

  -- changed_by must be the acting user
  NEW.changed_by := auth.uid();

  -- new_status must reflect the ride's actual current status
  IF NEW.new_status IS DISTINCT FROM cur_status THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION';
  END IF;

  -- old_status must match the last recorded status (or be null for the first entry)
  IF NEW.old_status IS DISTINCT FROM (
    SELECT h.new_status FROM public.group_ride_status_history h
    WHERE h.ride_id = NEW.ride_id ORDER BY h.created_at DESC LIMIT 1
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION';
  END IF;

  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_group_ride_status_history ON public.group_ride_status_history;
CREATE TRIGGER trg_validate_group_ride_status_history
BEFORE INSERT ON public.group_ride_status_history
FOR EACH ROW EXECUTE FUNCTION public.validate_group_ride_status_history();