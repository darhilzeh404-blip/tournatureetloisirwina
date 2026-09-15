-- ============================================================
-- FIX VTC : COMMISSION CHAUFFEUR À 10 %
-- ============================================================
-- Objectifs :
-- 1. Le client VTC paie uniquement avec son portefeuille Wina.
-- 2. Le chauffeur reçoit 90 % du montant de la course.
-- 3. Wina conserve 10 %.
-- 4. Un chauffeur ne peut pas être crédité deux fois pour la
--    même course.
-- 5. Le mécanisme MyPVIT n'est pas utilisé pour le VTC.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonnes nécessaires sur reservations
-- ------------------------------------------------------------

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS driver_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS driver_amount_at_booking integer;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS driver_earnings_credited boolean
    NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. S'assurer que les colonnes du wallet chauffeur existent
-- ------------------------------------------------------------

ALTER TABLE public.driver_wallet_transactions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'earning';

ALTER TABLE public.driver_wallet_transactions
  ADD COLUMN IF NOT EXISTS reference text;

-- ------------------------------------------------------------
-- 3. Protection contre le double crédit
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
  driver_wallet_tx_unique_earning_per_trip
ON public.driver_wallet_transactions (trip_id)
WHERE trip_id IS NOT NULL
  AND kind = 'earning';

-- ------------------------------------------------------------
-- 4. Fonction principale de crédit chauffeur
--
-- Commission Wina = 10 %
-- Chauffeur = 90 %
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.credit_driver_earnings(
  _driver_id uuid,
  _trip_id uuid,
  _reservation_id uuid,
  _gross_amount integer,
  _payment_method text DEFAULT 'wallet'::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$

DECLARE
  _fee integer;
  _net integer;
  _new_balance integer;
  _inserted uuid;

BEGIN

  IF _driver_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  IF _gross_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- Wina conserve 10 %
  _fee := FLOOR(_gross_amount * 0.10);

  -- Chauffeur reçoit 90 %
  _net := _gross_amount - _fee;

  -- Créer le wallet chauffeur s'il n'existe pas
  INSERT INTO public.driver_wallets(driver_id)
  VALUES (_driver_id)
  ON CONFLICT (driver_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- Enregistrer le gain
  --
  -- L'index unique sur trip_id empêche un double crédit.
  -- ----------------------------------------------------------

  INSERT INTO public.driver_wallet_transactions(
    driver_id,
    trip_id,
    reservation_id,
    gross_amount,
    platform_fee,
    net_amount,
    payment_method,
    status,
    kind,
    reference
  )
  VALUES (
    _driver_id,
    _trip_id,
    _reservation_id,
    _gross_amount,
    _fee,
    _net,
    COALESCE(_payment_method, 'wallet'),
    'completed',
    'earning',
    'TRIP-' || COALESCE(
      _trip_id::text,
      gen_random_uuid()::text
    )
  )
  ON CONFLICT (trip_id)
  WHERE trip_id IS NOT NULL
    AND kind = 'earning'
  DO NOTHING
  RETURNING id INTO _inserted;

  -- ----------------------------------------------------------
  -- Si la course a déjà été créditée :
  -- ne pas recréditer le chauffeur.
  -- ----------------------------------------------------------

  IF _inserted IS NULL THEN

    SELECT balance_earnings
    INTO _new_balance
    FROM public.driver_wallets
    WHERE driver_id = _driver_id;

    RETURN COALESCE(_new_balance, 0);

  END IF;

  -- ----------------------------------------------------------
  -- Créditer réellement le portefeuille chauffeur
  -- ----------------------------------------------------------

  UPDATE public.driver_wallets
  SET
    balance_earnings =
      balance_earnings + _net,

    total_earned =
      total_earned + _net,

    total_commission_paid =
      total_commission_paid + _fee,

    updated_at = now()

  WHERE driver_id = _driver_id

  RETURNING balance_earnings
  INTO _new_balance;

  RETURN COALESCE(_new_balance, 0);

END;

$function$;


-- ------------------------------------------------------------
-- 5. Fonction à un paramètre
--
-- Elle sert de passerelle avec la nouvelle logique centralisée.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.credit_driver_earnings(
  _reservation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$

DECLARE
  _reservation public.reservations%ROWTYPE;
  _trip public.trips%ROWTYPE;
  _balance integer;

BEGIN

  -- Verrouiller la réservation
  SELECT *
  INTO _reservation
  FROM public.reservations
  WHERE id = _reservation_id
  FOR UPDATE;

  IF _reservation.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  -- Seulement pour les réservations VTC
  IF _reservation.service_type <> 'VTC'::service_type THEN
    RETURN;
  END IF;

  -- Vérifier que la course existe
  SELECT *
  INTO _trip
  FROM public.trips
  WHERE reservation_id = _reservation.id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _trip.id IS NULL THEN
    RAISE EXCEPTION 'VTC_TRIP_NOT_FOUND';
  END IF;

  -- Le chauffeur vient de la course, pas de la réservation
  IF _trip.driver_id IS NULL THEN
    RAISE EXCEPTION 'VTC_DRIVER_NOT_ASSIGNED';
  END IF;

  -- Protection contre le double crédit
  IF COALESCE(
    _reservation.driver_earnings_credited,
    false
  ) THEN
    RETURN;
  END IF;

  -- Crédit réel du portefeuille chauffeur
  _balance := public.credit_driver_earnings(
    _trip.driver_id,
    _trip.id,
    _reservation.id,
    _reservation.total_amount,
    'wallet'
  );

  -- Marquer comme crédité uniquement après le crédit réel
  UPDATE public.reservations
  SET
    driver_earnings_credited = true,
    driver_amount_at_booking =
      _reservation.total_amount
      - FLOOR(_reservation.total_amount * 0.10),
    updated_at = now()
  WHERE id = _reservation.id;

END;

$function$;
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$

DECLARE
  _reservation public.reservations%ROWTYPE;
  _trip public.trips%ROWTYPE;
  _balance integer;

BEGIN

  -- Verrouiller la réservation
  SELECT *
  INTO _reservation
  FROM public.reservations
  WHERE id = _reservation_id
  FOR UPDATE;

  IF _reservation.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  -- Seulement VTC
  IF _reservation.service_type <> 'VTC'::service_type THEN
    RETURN;
  END IF;

  IF _trip.driver_id IS NULL THEN
    RAISE EXCEPTION 'VTC_DRIVER_NOT_ASSIGNED';
  END IF;

  -- Si déjà créditée, ne rien faire
  IF COALESCE(
    _reservation.driver_earnings_credited,
    false
  ) THEN
    RETURN;
  END IF;

  -- Trouver la course correspondant à la réservation
  SELECT *
  INTO _trip
  FROM public.trips
  WHERE reservation_id = _reservation.id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _trip.id IS NULL THEN
    RAISE EXCEPTION 'VTC_TRIP_NOT_FOUND';
  END IF;

  -- Crédit réel du wallet chauffeur
  _balance := public.credit_driver_earnings(
    _trip.driver_id,
    _trip.id,
    _reservation.id,
    _reservation.total_amount,
    'wallet'
  );

  -- Marquer seulement après le crédit réel
  UPDATE public.reservations
  SET
    driver_earnings_credited = true,
    driver_amount_at_booking =
      _reservation.total_amount
      - FLOOR(_reservation.total_amount * 0.10),
    updated_at = now()
  WHERE id = _reservation.id;

END;

$function$;


-- ------------------------------------------------------------
-- 6. Finaliser une course VTC
--
-- Le chauffeur reçoit 90 %.
-- Wina conserve 10 %.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_vtc_trip(
  _trip_id uuid
)
RETURNS TABLE(
  driver_net integer,
  driver_balance integer,
  paid_via_wallet boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$

DECLARE
  _uid uuid := auth.uid();
  _trip public.trips;
  _res public.reservations;
  _gross integer := 0;
  _net integer := 0;
  _balance integer := 0;
  _wallet boolean := false;

BEGIN

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Verrouiller la course
  SELECT *
  INTO _trip
  FROM public.trips
  WHERE id = _trip_id
  FOR UPDATE;

  IF _trip.id IS NULL THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  -- Seul le chauffeur de la course ou un admin peut terminer
  IF _trip.driver_id <> _uid
     AND NOT public.has_role(
       _uid,
       'admin'::app_role
     )
  THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Marquer la course comme terminée
  IF _trip.status NOT IN ('completed') THEN

    UPDATE public.trips
    SET
      status = 'completed',
      completed_at =
        COALESCE(completed_at, now()),
      updated_at = now()
    WHERE id = _trip_id;

  END IF;

  -- ----------------------------------------------------------
  -- Réservation associée
  -- ----------------------------------------------------------

  IF _trip.reservation_id IS NOT NULL THEN

    SELECT *
    INTO _res
    FROM public.reservations
    WHERE id = _trip.reservation_id
    FOR UPDATE;

    IF _res.id IS NOT NULL
       AND _res.service_type = 'VTC'::service_type
    THEN

      _gross := COALESCE(
        _res.total_amount,
        0
      );

      -- ------------------------------------------------------
      -- VTC = portefeuille uniquement
      -- ------------------------------------------------------

      IF _gross > 0
         AND _trip.driver_id IS NOT NULL
      THEN

        _balance := public.credit_driver_earnings(
          _trip.driver_id,
          _trip.id,
          _res.id,
          _gross,
          'wallet'
        );

        -- Chauffeur = 90 %
        _net :=
          _gross
          - FLOOR(_gross * 0.10);

        _wallet := true;

        -- Marquer comme crédité après le crédit réel
        UPDATE public.reservations
        SET
          driver_earnings_credited = true,
          driver_amount_at_booking = _net,
          updated_at = now()
        WHERE id = _res.id;

      END IF;

    END IF;

  END IF;

  -- ----------------------------------------------------------
  -- Archivage
  -- ----------------------------------------------------------

  UPDATE public.trips
  SET
    archived_at =
      COALESCE(archived_at, now()),
    updated_at = now()
  WHERE id = _trip_id;

  IF _trip.reservation_id IS NOT NULL THEN

    UPDATE public.reservations
    SET
      archived_at =
        COALESCE(archived_at, now()),
      updated_at = now()
    WHERE id = _trip.reservation_id;

  END IF;

  UPDATE public.driver_positions
  SET
    archived_at =
      COALESCE(archived_at, now()),
    updated_at = now()
  WHERE trip_id = _trip_id;

  UPDATE public.client_positions
  SET
    archived_at =
      COALESCE(archived_at, now()),
    updated_at = now()
  WHERE trip_id = _trip_id;

  RETURN QUERY
  SELECT
    _net,
    _balance,
    _wallet;

END;

$function$;


-- ------------------------------------------------------------
-- 7. Autoriser l'application à appeler complete_vtc_trip
-- ------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.complete_vtc_trip(uuid)
TO authenticated;

-- La fonction est SECURITY DEFINER :
-- les fonctions internes restent protégées.
REVOKE EXECUTE ON FUNCTION public.credit_driver_earnings(
  uuid,
  uuid,
  uuid,
  integer,
  text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.credit_driver_earnings(
  uuid
) FROM anon;

COMMIT;
