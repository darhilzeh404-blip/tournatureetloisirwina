
-- Trigger to atomically decrement / restore seats on partner_tickets based on partner_bookings changes.

CREATE OR REPLACE FUNCTION public.partner_bookings_manage_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INTEGER;
  v_delta INTEGER;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.ticket_id IS NULL OR COALESCE(NEW.seats, 0) <= 0 THEN
      RETURN NEW;
    END IF;
    IF NEW.status IN ('cancelled') THEN
      RETURN NEW;
    END IF;

    -- Lock the ticket row and check availability atomically
    SELECT seats_available INTO v_available
    FROM public.partner_tickets
    WHERE id = NEW.ticket_id
    FOR UPDATE;

    IF v_available IS NULL THEN
      RAISE EXCEPTION 'Billet introuvable' USING ERRCODE = 'P0002';
    END IF;

    IF v_available < NEW.seats THEN
      RAISE EXCEPTION 'Places insuffisantes: % restante(s), % demandée(s)', v_available, NEW.seats
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.partner_tickets
    SET seats_available = seats_available - NEW.seats,
        updated_at = now()
    WHERE id = NEW.ticket_id;

    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Restore seats when transitioning to cancelled
    IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled'
       AND OLD.ticket_id IS NOT NULL AND COALESCE(OLD.seats, 0) > 0 THEN
      UPDATE public.partner_tickets
      SET seats_available = seats_available + OLD.seats,
          updated_at = now()
      WHERE id = OLD.ticket_id;
      RETURN NEW;
    END IF;

    -- Re-decrement if a booking is re-activated from cancelled
    IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled'
       AND NEW.ticket_id IS NOT NULL AND COALESCE(NEW.seats, 0) > 0 THEN
      SELECT seats_available INTO v_available
      FROM public.partner_tickets
      WHERE id = NEW.ticket_id
      FOR UPDATE;
      IF v_available < NEW.seats THEN
        RAISE EXCEPTION 'Places insuffisantes: % restante(s), % demandée(s)', v_available, NEW.seats
          USING ERRCODE = '23514';
      END IF;
      UPDATE public.partner_tickets
      SET seats_available = seats_available - NEW.seats,
          updated_at = now()
      WHERE id = NEW.ticket_id;
      RETURN NEW;
    END IF;

    -- Adjust delta if seats changed on an active booking
    IF NEW.status <> 'cancelled' AND OLD.status <> 'cancelled'
       AND NEW.ticket_id = OLD.ticket_id
       AND COALESCE(NEW.seats, 0) <> COALESCE(OLD.seats, 0) THEN
      v_delta := COALESCE(NEW.seats, 0) - COALESCE(OLD.seats, 0);
      IF v_delta > 0 THEN
        SELECT seats_available INTO v_available
        FROM public.partner_tickets
        WHERE id = NEW.ticket_id
        FOR UPDATE;
        IF v_available < v_delta THEN
          RAISE EXCEPTION 'Places insuffisantes: % restante(s), % demandée(s) supplémentaire(s)', v_available, v_delta
            USING ERRCODE = '23514';
        END IF;
      END IF;
      UPDATE public.partner_tickets
      SET seats_available = seats_available - v_delta,
          updated_at = now()
      WHERE id = NEW.ticket_id;
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    -- Restore seats if an active booking is deleted
    IF OLD.ticket_id IS NOT NULL AND COALESCE(OLD.seats, 0) > 0
       AND COALESCE(OLD.status, '') <> 'cancelled' THEN
      UPDATE public.partner_tickets
      SET seats_available = seats_available + OLD.seats,
          updated_at = now()
      WHERE id = OLD.ticket_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_bookings_manage_seats_ins ON public.partner_bookings;
DROP TRIGGER IF EXISTS trg_partner_bookings_manage_seats_upd ON public.partner_bookings;
DROP TRIGGER IF EXISTS trg_partner_bookings_manage_seats_del ON public.partner_bookings;

CREATE TRIGGER trg_partner_bookings_manage_seats_ins
BEFORE INSERT ON public.partner_bookings
FOR EACH ROW EXECUTE FUNCTION public.partner_bookings_manage_seats();

CREATE TRIGGER trg_partner_bookings_manage_seats_upd
AFTER UPDATE ON public.partner_bookings
FOR EACH ROW EXECUTE FUNCTION public.partner_bookings_manage_seats();

CREATE TRIGGER trg_partner_bookings_manage_seats_del
AFTER DELETE ON public.partner_bookings
FOR EACH ROW EXECUTE FUNCTION public.partner_bookings_manage_seats();

-- Prevent negative seats at storage level
ALTER TABLE public.partner_tickets
  DROP CONSTRAINT IF EXISTS partner_tickets_seats_available_non_negative;
ALTER TABLE public.partner_tickets
  ADD CONSTRAINT partner_tickets_seats_available_non_negative
  CHECK (seats_available >= 0);
