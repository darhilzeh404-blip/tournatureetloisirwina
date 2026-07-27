ALTER TABLE public.vessels
  ADD COLUMN IF NOT EXISTS price_adult numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_child numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_infant numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baggage_free_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS baggage_fee_per_extra numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baggage_max_count integer NOT NULL DEFAULT 10;

ALTER TABLE public.boat_sailings
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;

ALTER TABLE public.boat_sailings ALTER COLUMN departure_date DROP NOT NULL;
ALTER TABLE public.boat_sailings ALTER COLUMN seats_total SET DEFAULT 0;
ALTER TABLE public.boat_sailings ALTER COLUMN seats_available SET DEFAULT 0;

UPDATE public.boat_sailings
  SET period_start = COALESCE(period_start, departure_date),
      period_end = COALESCE(period_end, departure_date)
  WHERE period_start IS NULL OR period_end IS NULL;

CREATE OR REPLACE FUNCTION public.boat_sailings_manage_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _avail integer; _total integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sailing_id IS NULL OR NEW.status = 'cancelled' THEN RETURN NEW; END IF;
    SELECT seats_available, seats_total INTO _avail, _total FROM public.boat_sailings WHERE id = NEW.sailing_id FOR UPDATE;
    IF _avail IS NULL THEN RAISE EXCEPTION 'SAILING_NOT_FOUND'; END IF;
    IF COALESCE(_total, 0) = 0 THEN RETURN NEW; END IF;
    IF _avail < NEW.seats THEN RAISE EXCEPTION 'INSUFFICIENT_SEATS'; END IF;
    UPDATE public.boat_sailings
      SET seats_available = seats_available - NEW.seats,
          status = CASE WHEN seats_available - NEW.seats <= 0 THEN 'full' ELSE status END,
          updated_at = now()
      WHERE id = NEW.sailing_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.sailing_id IS NOT NULL AND OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
      UPDATE public.boat_sailings
        SET seats_available = LEAST(seats_total, seats_available + OLD.seats),
            status = CASE WHEN status = 'full' THEN 'active' ELSE status END,
            updated_at = now()
        WHERE id = OLD.sailing_id AND COALESCE(seats_total, 0) > 0;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;