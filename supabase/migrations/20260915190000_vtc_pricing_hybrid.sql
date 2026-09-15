-- ============================================================================
-- WINA TOUR - VTC PRICING HYBRID
-- Migration: 20260915190000_vtc_pricing_hybrid.sql
--
-- OBJECTIFS
-- 1. Couverture Akanda, y compris Malibé
-- 2. Couverture Libreville Nord / Centre / Sud
-- 3. Couverture Owendo
-- 4. Couverture Ntoum
-- 5. Tarification hybride :
--      0-5 km       = tarif de base
--      >5-8 km      = tarif intermédiaire
--      >8-10 km     = tarif supérieur
--      >10 km       = tarif supérieur + supplément/km
-- 6. Standard      = +300 FCFA/km au-delà de 10 km
-- 7. Confort       = +390 FCFA/km au-delà de 10 km
-- 8. VIP           = +600 FCFA/km au-delà de 10 km
-- 9. Interzones conservées
-- 10. Paiement/commission conducteur NON MODIFIÉS
--
-- IMPORTANT :
-- Cette migration NE recrée PAS :
--   - credit_driver_earnings
--   - complete_vtc_trip
--   - pay_reservation_with_wallet
-- ============================================================================




-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 2. ZONES VTC
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vtc_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  zone_code text NOT NULL UNIQUE,
  zone_name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'city',

  min_lat numeric NOT NULL,
  max_lat numeric NOT NULL,
  min_lng numeric NOT NULL,
  max_lng numeric NOT NULL,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vtc_zones_valid_lat
    CHECK (min_lat < max_lat),

  CONSTRAINT vtc_zones_valid_lng
    CHECK (min_lng < max_lng),

  CONSTRAINT vtc_zones_valid_type
    CHECK (zone_type IN ('city', 'subzone', 'airport'))
);


-- ============================================================================
-- 3. RESET DES ZONES GÉOGRAPHIQUES
-- ============================================================================
--
-- L'ordre de détection sera :
--   1. Aéroport
--   2. Ntoum
--   3. Owendo
--   4. Libreville Nord/Centre/Sud
--   5. Akanda
--
-- Cela évite qu'une grande zone Akanda englobe accidentellement une autre zone.
--
-- Akanda est volontairement élargie vers le nord et l'est afin de couvrir
-- l'ensemble du secteur, notamment Malibé.
-- ============================================================================

DELETE FROM public.vtc_zones;

INSERT INTO public.vtc_zones (
  zone_code,
  zone_name,
  zone_type,
  min_lat,
  max_lat,
  min_lng,
  max_lng
)
VALUES

-- --------------------------------------------------------------------------
-- AKANDA
-- --------------------------------------------------------------------------
(
  'AKANDA',
  'Akanda',
  'city',
  0.5400,
  0.7000,
  9.3200,
  9.6000
),

-- --------------------------------------------------------------------------
-- LIBREVILLE
-- --------------------------------------------------------------------------
(
  'LIBREVILLE_NORD',
  'Libreville Nord',
  'subzone',
  0.4550,
  0.5400,
  9.3700,
  9.5200
),

(
  'LIBREVILLE_CENTRE',
  'Libreville Centre',
  'subzone',
  0.4100,
  0.4550,
  9.3700,
  9.5200
),

(
  'LIBREVILLE_SUD',
  'Libreville Sud',
  'subzone',
  0.3700,
  0.4100,
  9.3700,
  9.5200
),

-- --------------------------------------------------------------------------
-- OWENDO
-- --------------------------------------------------------------------------
(
  'OWENDO',
  'Owendo',
  'city',
  0.2500,
  0.3700,
  9.4400,
  9.5400
),

-- --------------------------------------------------------------------------
-- NTOUM
-- --------------------------------------------------------------------------
(
  'NTOUM',
  'Ntoum',
  'city',
  0.3000,
  0.4700,
  9.6500,
  9.8500
),

-- --------------------------------------------------------------------------
-- AÉROPORT LÉON-MBA
-- --------------------------------------------------------------------------
(
  'AIRPORT',
  'Aéroport Léon-MBA',
  'airport',
  0.4450,
  0.4750,
  9.3900,
  9.4400
);


-- ============================================================================
-- 4. TABLE DES RÈGLES TARIFAIRES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vtc_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  mode text NOT NULL DEFAULT 'express',
  pickup_zone text NOT NULL,
  destination_zone text NOT NULL,
  min_distance_km numeric NOT NULL DEFAULT 0,
  max_distance_km numeric,
  base_price integer NOT NULL DEFAULT 0,
  minimum_price integer NOT NULL DEFAULT 0,
  pricing_rule text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vtc_pricing_category_check
    CHECK (category IN ('standard', 'confort', 'vip')),

  CONSTRAINT vtc_pricing_mode_check
    CHECK (mode IN ('express', 'hour')),

  CONSTRAINT vtc_pricing_distance_check
    CHECK (
      min_distance_km >= 0
      AND (max_distance_km IS NULL OR max_distance_km > min_distance_km)
    ),

  CONSTRAINT vtc_pricing_price_check
    CHECK (base_price >= 0 AND minimum_price >= 0)
);


-- ============================================================================
-- 5. NETTOYAGE DES ANCIENNES RÈGLES
-- ============================================================================
--
-- On repart d'une grille propre afin d'éviter les doublons provenant
-- des anciennes migrations.
-- ============================================================================

DELETE FROM public.vtc_pricing_rules;


-- ============================================================================
-- 6. FONCTION UTILITAIRE : ARRONDI AU CENTAINE SUPÉRIEURE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.vtc_round_up_100(
  _amount numeric
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (CEIL(_amount / 100.0) * 100)::integer;
$$;


-- ============================================================================
-- 7. INSERTION DES TARIFS STANDARD - TRAJETS INTERNES
-- ============================================================================

-- --------------------------------------------------------------------------
-- AKANDA
-- --------------------------------------------------------------------------

INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
VALUES
(
  'standard',
  'express',
  'AKANDA',
  'AKANDA',
  0,
  5,
  2000,
  2000,
  'Standard Akanda - 0 à 5 km'
),
(
  'standard',
  'express',
  'AKANDA',
  'AKANDA',
  5,
  8,
  2500,
  2500,
  'Standard Akanda - plus de 5 à 8 km'
),
(
  'standard',
  'express',
  'AKANDA',
  'AKANDA',
  8,
  10,
  3000,
  3000,
  'Standard Akanda - plus de 8 à 10 km'
);

-- --------------------------------------------------------------------------
-- LIBREVILLE NORD
-- --------------------------------------------------------------------------

INSERT INTO public.vtc_pricing_rules VALUES
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_NORD',
  'LIBREVILLE_NORD',
  0,
  5,
  2000,
  2000,
  'Standard Libreville Nord - 0 à 5 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_NORD',
  'LIBREVILLE_NORD',
  5,
  8,
  2500,
  2500,
  'Standard Libreville Nord - plus de 5 à 8 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_NORD',
  'LIBREVILLE_NORD',
  8,
  10,
  3000,
  3000,
  'Standard Libreville Nord - plus de 8 à 10 km',
  true,
  now(),
  now()
);

-- --------------------------------------------------------------------------
-- LIBREVILLE CENTRE
-- --------------------------------------------------------------------------

INSERT INTO public.vtc_pricing_rules VALUES
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_CENTRE',
  'LIBREVILLE_CENTRE',
  0,
  5,
  2000,
  2000,
  'Standard Libreville Centre - 0 à 5 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_CENTRE',
  'LIBREVILLE_CENTRE',
  5,
  8,
  2500,
  2500,
  'Standard Libreville Centre - plus de 5 à 8 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_CENTRE',
  'LIBREVILLE_CENTRE',
  8,
  10,
  3000,
  3000,
  'Standard Libreville Centre - plus de 8 à 10 km',
  true,
  now(),
  now()
);

-- --------------------------------------------------------------------------
-- LIBREVILLE SUD
-- --------------------------------------------------------------------------

INSERT INTO public.vtc_pricing_rules VALUES
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_SUD',
  'LIBREVILLE_SUD',
  0,
  5,
  2000,
  2000,
  'Standard Libreville Sud - 0 à 5 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_SUD',
  'LIBREVILLE_SUD',
  5,
  8,
  2500,
  2500,
  'Standard Libreville Sud - plus de 5 à 8 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'LIBREVILLE_SUD',
  'LIBREVILLE_SUD',
  8,
  10,
  3000,
  3000,
  'Standard Libreville Sud - plus de 8 à 10 km',
  true,
  now(),
  now()
);

-- --------------------------------------------------------------------------
-- OWENDO
-- --------------------------------------------------------------------------

INSERT INTO public.vtc_pricing_rules VALUES
(
  gen_random_uuid(),
  'standard',
  'express',
  'OWENDO',
  'OWENDO',
  0,
  5,
  2000,
  2000,
  'Standard Owendo - 0 à 5 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'OWENDO',
  'OWENDO',
  5,
  8,
  2500,
  2500,
  'Standard Owendo - plus de 5 à 8 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'OWENDO',
  'OWENDO',
  8,
  10,
  3000,
  3000,
  'Standard Owendo - plus de 8 à 10 km',
  true,
  now(),
  now()
);

-- --------------------------------------------------------------------------
-- NTOUM
-- --------------------------------------------------------------------------

INSERT INTO public.vtc_pricing_rules VALUES
(
  gen_random_uuid(),
  'standard',
  'express',
  'NTOUM',
  'NTOUM',
  0,
  5,
  2000,
  2000,
  'Standard Ntoum - 0 à 5 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'NTOUM',
  'NTOUM',
  5,
  8,
  2500,
  2500,
  'Standard Ntoum - plus de 5 à 8 km',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'standard',
  'express',
  'NTOUM',
  'NTOUM',
  8,
  10,
  3000,
  3000,
  'Standard Ntoum - plus de 8 à 10 km',
  true,
  now(),
  now()
);


-- ============================================================================
-- 8. TARIFS INTERZONES STANDARD
-- ============================================================================

CREATE TEMP TABLE tmp_vtc_cross_zone (
  zone_a text,
  zone_b text,
  price integer,
  label text
) ON COMMIT DROP;

INSERT INTO tmp_vtc_cross_zone VALUES
('AKANDA',          'LIBREVILLE_NORD',   3000, 'Akanda ↔ Libreville'),
('AKANDA',          'LIBREVILLE_CENTRE', 3000, 'Akanda ↔ Libreville'),
('AKANDA',          'LIBREVILLE_SUD',    3000, 'Akanda ↔ Libreville'),

('LIBREVILLE_NORD', 'LIBREVILLE_CENTRE', 3000, 'Libreville Nord ↔ Centre'),
('LIBREVILLE_CENTRE','LIBREVILLE_SUD',   3000, 'Libreville Centre ↔ Sud'),
('LIBREVILLE_NORD', 'LIBREVILLE_SUD',    3500, 'Libreville Nord ↔ Sud'),

('LIBREVILLE_NORD', 'OWENDO',            4000, 'Libreville ↔ Owendo'),
('LIBREVILLE_CENTRE','OWENDO',           4000, 'Libreville ↔ Owendo'),
('LIBREVILLE_SUD',  'OWENDO',            4000, 'Libreville ↔ Owendo'),

('LIBREVILLE_NORD', 'NTOUM',             5000, 'Libreville ↔ Ntoum'),
('LIBREVILLE_CENTRE','NTOUM',            5000, 'Libreville ↔ Ntoum'),
('LIBREVILLE_SUD',  'NTOUM',             5000, 'Libreville ↔ Ntoum'),

('AKANDA',          'OWENDO',            5000, 'Akanda ↔ Owendo'),
('AKANDA',          'NTOUM',             6000, 'Akanda ↔ Ntoum'),
('OWENDO',          'NTOUM',             5500, 'Owendo ↔ Ntoum');


-- ============================================================================
-- 9. INSERTION DES RÈGLES INTERZONES
-- ============================================================================

INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
SELECT
  'standard',
  'express',
  zone_a,
  zone_b,
  0,
  NULL,
  price,
  price,
  label
FROM tmp_vtc_cross_zone;

INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
SELECT
  'standard',
  'express',
  zone_b,
  zone_a,
  0,
  NULL,
  price,
  price,
  label
FROM tmp_vtc_cross_zone;


-- ============================================================================
-- 10. AÉROPORT
-- ============================================================================
--
-- Les règles Aéroport sont séparées afin que l'aéroport soit toujours détecté
-- avant Libreville Nord.
--
-- Tarif de référence conservé pour la liaison Aéroport ↔ Libreville :
-- 4 000 FCFA Standard.
--
-- Akanda ↔ Aéroport :
-- 4 000 FCFA Standard.
--
-- Owendo ↔ Aéroport :
-- 5 000 FCFA Standard.
--
-- Ntoum ↔ Aéroport :
-- 6 000 FCFA Standard.
-- ============================================================================

INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
VALUES
(
  'standard',
  'express',
  'AIRPORT',
  'LIBREVILLE_NORD',
  0,
  NULL,
  4000,
  4000,
  'Aéroport Léon-MBA ↔ Libreville'
),
(
  'standard',
  'express',
  'LIBREVILLE_NORD',
  'AIRPORT',
  0,
  NULL,
  4000,
  4000,
  'Libreville ↔ Aéroport Léon-MBA'
),
(
  'standard',
  'express',
  'AIRPORT',
  'LIBREVILLE_CENTRE',
  0,
  NULL,
  4000,
  4000,
  'Aéroport Léon-MBA ↔ Libreville'
),
(
  'standard',
  'express',
  'LIBREVILLE_CENTRE',
  'AIRPORT',
  0,
  NULL,
  4000,
  4000,
  'Libreville ↔ Aéroport Léon-MBA'
),
(
  'standard',
  'express',
  'AIRPORT',
  'LIBREVILLE_SUD',
  0,
  NULL,
  4000,
  4000,
  'Aéroport Léon-MBA ↔ Libreville'
),
(
  'standard',
  'express',
  'LIBREVILLE_SUD',
  'AIRPORT',
  0,
  NULL,
  4000,
  4000,
  'Libreville ↔ Aéroport Léon-MBA'
),
(
  'standard',
  'express',
  'AIRPORT',
  'AKANDA',
  0,
  NULL,
  4000,
  4000,
  'Aéroport Léon-MBA ↔ Akanda'
),
(
  'standard',
  'express',
  'AKANDA',
  'AIRPORT',
  0,
  NULL,
  4000,
  4000,
  'Akanda ↔ Aéroport Léon-MBA'
),
(
  'standard',
  'express',
  'AIRPORT',
  'OWENDO',
  0,
  NULL,
  5000,
  5000,
  'Aéroport Léon-MBA ↔ Owendo'
),
(
  'standard',
  'express',
  'OWENDO',
  'AIRPORT',
  0,
  NULL,
  5000,
  5000,
  'Owendo ↔ Aéroport Léon-MBA'
),
(
  'standard',
  'express',
  'AIRPORT',
  'NTOUM',
  0,
  NULL,
  6000,
  6000,
  'Aéroport Léon-MBA ↔ Ntoum'
),
(
  'standard',
  'express',
  'NTOUM',
  'AIRPORT',
  0,
  NULL,
  6000,
  6000,
  'Ntoum ↔ Aéroport Léon-MBA'
);


-- ============================================================================
-- 11. TARIFS CONFORT ET VIP
-- ============================================================================
--
-- Confort = Standard + 30 %, arrondi à la centaine supérieure.
-- VIP = Standard x 2.
--
-- Pour les trajets internes :
--   Standard : 2000 / 2500 / 3000
--   Confort  : 2600 / 3300 / 3900
--   VIP      : 4000 / 5000 / 6000
-- ============================================================================

INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
SELECT
  'confort',
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  public.vtc_round_up_100(base_price * 1.30),
  public.vtc_round_up_100(base_price * 1.30),
  replace(pricing_rule, 'Standard', 'Confort')
FROM public.vtc_pricing_rules
WHERE category = 'standard'
  AND mode = 'express'
  AND pickup_zone = destination_zone
  AND pickup_zone <> 'AIRPORT';


INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
SELECT
  'vip',
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price * 2,
  minimum_price * 2,
  replace(pricing_rule, 'Standard', 'VIP')
FROM public.vtc_pricing_rules
WHERE category = 'standard'
  AND mode = 'express'
  AND pickup_zone = destination_zone
  AND pickup_zone <> 'AIRPORT';


-- Interzones Confort

INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
SELECT
  'confort',
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  public.vtc_round_up_100(base_price * 1.30),
  public.vtc_round_up_100(minimum_price * 1.30),
  replace(pricing_rule, 'Standard', 'Confort')
FROM public.vtc_pricing_rules
WHERE category = 'standard'
  AND pickup_zone <> destination_zone;


-- Interzones VIP

INSERT INTO public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  pricing_rule
)
SELECT
  'vip',
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km,
  base_price * 2,
  minimum_price * 2,
  replace(pricing_rule, 'Standard', 'VIP')
FROM public.vtc_pricing_rules
WHERE category = 'standard'
  AND pickup_zone <> destination_zone;


-- ============================================================================
-- 12. DISTANCE HAVERSINE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.vtc_distance_km(
  _lat1 numeric,
  _lng1 numeric,
  _lat2 numeric,
  _lng2 numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    6371.0 * 2.0 * ASIN(
      SQRT(
        POWER(
          SIN(RADIANS((_lat2 - _lat1) / 2.0)),
          2
        )
        +
        COS(RADIANS(_lat1))
        * COS(RADIANS(_lat2))
        * POWER(
          SIN(RADIANS((_lng2 - _lng1) / 2.0)),
          2
        )
      )
    );
$$;


-- ============================================================================
-- 13. DÉTECTION DE ZONE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_vtc_zone(
  _lat numeric,
  _lng numeric
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _zone text;
BEGIN

  -- Aéroport en priorité
  SELECT zone_code
  INTO _zone
  FROM public.vtc_zones
  WHERE zone_code = 'AIRPORT'
    AND is_active
    AND _lat BETWEEN min_lat AND max_lat
    AND _lng BETWEEN min_lng AND max_lng
  LIMIT 1;

  IF _zone IS NOT NULL THEN
    RETURN _zone;
  END IF;


  -- Ntoum
  SELECT zone_code
  INTO _zone
  FROM public.vtc_zones
  WHERE zone_code = 'NTOUM'
    AND is_active
    AND _lat BETWEEN min_lat AND max_lat
    AND _lng BETWEEN min_lng AND max_lng
  LIMIT 1;

  IF _zone IS NOT NULL THEN
    RETURN _zone;
  END IF;


  -- Owendo
  SELECT zone_code
  INTO _zone
  FROM public.vtc_zones
  WHERE zone_code = 'OWENDO'
    AND is_active
    AND _lat BETWEEN min_lat AND max_lat
    AND _lng BETWEEN min_lng AND max_lng
  LIMIT 1;

  IF _zone IS NOT NULL THEN
    RETURN _zone;
  END IF;


  -- Libreville Nord
  SELECT zone_code
  INTO _zone
  FROM public.vtc_zones
  WHERE zone_code = 'LIBREVILLE_NORD'
    AND is_active
    AND _lat >= min_lat
    AND _lat < max_lat
    AND _lng BETWEEN min_lng AND max_lng
  LIMIT 1;

  IF _zone IS NOT NULL THEN
    RETURN _zone;
  END IF;


  -- Libreville Centre
  SELECT zone_code
  INTO _zone
  FROM public.vtc_zones
  WHERE zone_code = 'LIBREVILLE_CENTRE'
    AND is_active
    AND _lat >= min_lat
    AND _lat < max_lat
    AND _lng BETWEEN min_lng AND max_lng
  LIMIT 1;

  IF _zone IS NOT NULL THEN
    RETURN _zone;
  END IF;


  -- Libreville Sud
  SELECT zone_code
  INTO _zone
  FROM public.vtc_zones
  WHERE zone_code = 'LIBREVILLE_SUD'
    AND is_active
    AND _lat >= min_lat
    AND _lat < max_lat
    AND _lng BETWEEN min_lng AND max_lng
  LIMIT 1;

  IF _zone IS NOT NULL THEN
    RETURN _zone;
  END IF;


  -- Akanda en dernier.
  -- Cette zone couvre volontairement une zone plus large afin d'inclure
  -- notamment Malibé.
  SELECT zone_code
  INTO _zone
  FROM public.vtc_zones
  WHERE zone_code = 'AKANDA'
    AND is_active
    AND _lat BETWEEN min_lat AND max_lat
    AND _lng BETWEEN min_lng AND max_lng
  LIMIT 1;

  RETURN _zone;
END;
$$;


-- ============================================================================
-- 14. CALCUL DU TARIF VTC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_vtc_price(
  _pickup_lat numeric,
  _pickup_lng numeric,
  _destination_lat numeric,
  _destination_lng numeric,
  _category text DEFAULT 'standard',
  _mode text DEFAULT 'express',
  _billable_hours integer DEFAULT 1
)
RETURNS TABLE (
  total_client integer,
  wina_commission integer,
  driver_amount integer,
  currency text,
  pricing_rule_id uuid,
  pricing_rule text,
  pickup_zone text,
  destination_zone text,
  distance_km numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE

  _pickup_zone text;
  _destination_zone text;

  _distance numeric;

  _rule public.vtc_pricing_rules%ROWTYPE;

  _base_price integer;
  _total integer;

  _category text;
  _mode text;

  _hours integer;

BEGIN

  _category := lower(coalesce(_category, 'standard'));
  _mode := lower(coalesce(_mode, 'express'));

  IF _category NOT IN ('standard', 'confort', 'vip') THEN
    RAISE EXCEPTION 'VTC_INVALID_CATEGORY';
  END IF;

  IF _mode NOT IN ('express', 'hour') THEN
    RAISE EXCEPTION 'VTC_INVALID_MODE';
  END IF;

  _hours := GREATEST(coalesce(_billable_hours, 1), 1);


  -- ------------------------------------------------------------------------
  -- Détection des zones
  -- ------------------------------------------------------------------------

  _pickup_zone :=
    public.detect_vtc_zone(
      _pickup_lat,
      _pickup_lng
    );

  IF _pickup_zone IS NULL THEN
    RAISE EXCEPTION 'VTC_PICKUP_ZONE_NOT_FOUND';
  END IF;


  _destination_zone :=
    public.detect_vtc_zone(
      _destination_lat,
      _destination_lng
    );

  IF _destination_zone IS NULL THEN
    RAISE EXCEPTION 'VTC_DESTINATION_ZONE_NOT_FOUND';
  END IF;


  -- ------------------------------------------------------------------------
  -- Distance
  -- ------------------------------------------------------------------------

  _distance :=
    ROUND(
      public.vtc_distance_km(
        _pickup_lat,
        _pickup_lng,
        _destination_lat,
        _destination_lng
      ),
      2
    );


  -- ------------------------------------------------------------------------
  -- MODE HORAIRE
  --
  -- On conserve le comportement historique :
  -- le mode horaire utilise la règle interne de la zone de départ.
  -- ------------------------------------------------------------------------

  IF _mode = 'hour' THEN

    SELECT *
    INTO _rule
    FROM public.vtc_pricing_rules r
    WHERE r.is_active = true
      AND r.category = _category
      AND r.mode = 'express'
      AND r.pickup_zone = r.destination_zone
      AND r.pickup_zone = _pickup_zone
    ORDER BY r.min_distance_km
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VTC_PRICING_RULE_NOT_FOUND';
    END IF;

    _base_price := _rule.base_price;

    _total := _base_price * _hours;

  ELSE

    -- ----------------------------------------------------------------------
    -- TRAJET INTERZONE
    -- ----------------------------------------------------------------------

    IF _pickup_zone <> _destination_zone THEN

      SELECT *
      INTO _rule
      FROM public.vtc_pricing_rules r
      WHERE r.is_active = true
        AND r.category = _category
        AND r.mode = 'express'
        AND r.pickup_zone = _pickup_zone
        AND r.destination_zone = _destination_zone
      ORDER BY
        CASE
          WHEN r.max_distance_km IS NULL THEN 0
          ELSE 1
        END,
        r.min_distance_km
      LIMIT 1;

      IF FOUND THEN
        _total := GREATEST(
          _rule.base_price,
          _rule.minimum_price
        );

      ELSE

        RAISE EXCEPTION 'VTC_PRICING_RULE_NOT_FOUND';

      END IF;


    -- ----------------------------------------------------------------------
    -- TRAJET INTERNE
    -- ----------------------------------------------------------------------

    ELSE

      -- >10 km :
      -- on prend la règle 8-10 km comme base puis on ajoute le prix/km.
      IF _distance > 10 THEN

        SELECT *
        INTO _rule
        FROM public.vtc_pricing_rules r
        WHERE r.is_active = true
          AND r.category = _category
          AND r.mode = 'express'
          AND r.pickup_zone = _pickup_zone
          AND r.destination_zone = _destination_zone
          AND r.min_distance_km = 8
          AND r.max_distance_km = 10
        LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'VTC_PRICING_RULE_NOT_FOUND';
        END IF;


        IF _category = 'standard' THEN

          _total :=
            _rule.base_price
            + CEIL((_distance - 10) * 300);

        ELSIF _category = 'confort' THEN

          _total :=
            public.vtc_round_up_100(
              _rule.base_price
              + ((_distance - 10) * 390)
            );

        ELSE

          _total :=
            _rule.base_price
            + CEIL((_distance - 10) * 600);

        END IF;


      ELSE

        -- ------------------------------------------------------------------
        -- 0-5 / 5-8 / 8-10 km
        -- ------------------------------------------------------------------

        SELECT *
        INTO _rule
        FROM public.vtc_pricing_rules r
        WHERE r.is_active = true
          AND r.category = _category
          AND r.mode = 'express'
          AND r.pickup_zone = _pickup_zone
          AND r.destination_zone = _destination_zone
          AND _distance >= r.min_distance_km
          AND (
            r.max_distance_km IS NULL
            OR _distance <= r.max_distance_km
          )
        ORDER BY r.min_distance_km DESC
        LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'VTC_PRICING_RULE_NOT_FOUND';
        END IF;

        _total :=
          GREATEST(
            _rule.base_price,
            _rule.minimum_price
          );

      END IF;

    END IF;

  END IF;


  -- ------------------------------------------------------------------------
  -- Sécurité tarifaire
  -- ------------------------------------------------------------------------

  _total := GREATEST(_total, 0);


  -- ------------------------------------------------------------------------
  -- Commission Wina = 10 %
  -- Conducteur = 90 %
  --
  -- Cette fonction ne crédite PAS le portefeuille.
  -- Elle fournit uniquement l'estimation tarifaire.
  -- ------------------------------------------------------------------------

  RETURN QUERY
  SELECT
    _total,
    FLOOR(_total * 0.10)::integer,
    (_total - FLOOR(_total * 0.10)::integer),
    'XAF'::text,
    _rule.id,
    _rule.pricing_rule,
    _pickup_zone,
    _destination_zone,
    _distance;

END;
$$;


-- ============================================================================
-- 15. COLONNES SNAPSHOT SUR RESERVATIONS
-- ============================================================================

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS price_at_booking integer;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS wina_commission_at_booking integer;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS driver_amount_at_booking integer;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pricing_rule_id uuid;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pickup_zone text;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS destination_zone text;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS distance_km numeric;


-- ============================================================================
-- 16. INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vtc_pricing_rules_lookup
ON public.vtc_pricing_rules (
  category,
  mode,
  pickup_zone,
  destination_zone,
  min_distance_km,
  max_distance_km
);

CREATE INDEX IF NOT EXISTS idx_reservations_vtc_pricing_rule
ON public.reservations (pricing_rule_id);

CREATE INDEX IF NOT EXISTS idx_reservations_vtc_zones
ON public.reservations (pickup_zone, destination_zone);


-- ============================================================================
-- 17. SNAPSHOT TARIFAIRE À LA CRÉATION D'UNE RÉSERVATION VTC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_vtc_pricing_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE

  _category text;
  _mode text;

  _result record;

BEGIN

  -- Seulement VTC
  IF upper(coalesce(NEW.service_type, '')) <> 'VTC' THEN
    RETURN NEW;
  END IF;


  -- ------------------------------------------------------------------------
  -- Paiement VTC = WALLET uniquement
  -- ------------------------------------------------------------------------

  IF NEW.details IS NULL THEN
    NEW.details := '{}'::jsonb;
  END IF;

  IF NOT (
    lower(coalesce(NEW.details ->> 'payment_mode', 'wallet'))
    = 'wallet'
  ) THEN
    RAISE EXCEPTION 'VTC_WALLET_ONLY';
  END IF;


  -- ------------------------------------------------------------------------
  -- Si le prix est déjà figé, ne pas le recalculer.
  -- ------------------------------------------------------------------------

  IF NEW.price_at_booking IS NOT NULL
     AND NEW.pricing_rule_id IS NOT NULL
  THEN
    RETURN NEW;
  END IF;


  _category :=
    lower(
      coalesce(
        NEW.details ->> 'category',
        NEW.details ->> 'vehicle_category',
        'standard'
      )
    );

  _mode :=
    lower(
      coalesce(
        NEW.details ->> 'mode',
        'express'
      )
    );


  -- ------------------------------------------------------------------------
  -- Coordonnées
  --
  -- On accepte plusieurs noms utilisés par les différentes versions
  -- du frontend.
  -- ------------------------------------------------------------------------

  IF NEW.details ->> 'pickup_lat' IS NULL
     OR NEW.details ->> 'pickup_lng' IS NULL
     OR NEW.details ->> 'destination_lat' IS NULL
     OR NEW.details ->> 'destination_lng' IS NULL
  THEN
    RETURN NEW;
  END IF;


  SELECT *
  INTO _result
  FROM public.calculate_vtc_price(
    (NEW.details ->> 'pickup_lat')::numeric,
    (NEW.details ->> 'pickup_lng')::numeric,
    (NEW.details ->> 'destination_lat')::numeric,
    (NEW.details ->> 'destination_lng')::numeric,
    _category,
    _mode,
    GREATEST(
      coalesce(
        NULLIF(NEW.details ->> 'billable_hours', '')::integer,
        1
      ),
      1
    )
  );


  NEW.total_amount :=
    _result.total_client;

  NEW.price_at_booking :=
    _result.total_client;

  NEW.wina_commission_at_booking :=
    _result.wina_commission;

  NEW.driver_amount_at_booking :=
    _result.driver_amount;

  NEW.pricing_rule_id :=
    _result.pricing_rule_id;

  NEW.pickup_zone :=
    _result.pickup_zone;

  NEW.destination_zone :=
    _result.destination_zone;

  NEW.distance_km :=
    _result.distance_km;


  RETURN NEW;

END;
$$;


-- ============================================================================
-- 18. TRIGGER SNAPSHOT
-- ============================================================================

DROP TRIGGER IF EXISTS trg_set_vtc_pricing_snapshot
ON public.reservations;

CREATE TRIGGER trg_set_vtc_pricing_snapshot
BEFORE INSERT OR UPDATE OF
  total_amount,
  details,
  service_type
ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.set_vtc_pricing_snapshot();


-- ============================================================================
-- 19. INTERDICTION DU CASH POUR LES VTC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_vtc_cash_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

  IF upper(coalesce(NEW.service_type, '')) = 'VTC' THEN

    IF NEW.details IS NULL THEN
      NEW.details := '{}'::jsonb;
    END IF;

    IF lower(
      coalesce(
        NEW.details ->> 'payment_mode',
        'wallet'
      )
    ) <> 'wallet'
    THEN
      RAISE EXCEPTION 'VTC_WALLET_ONLY';
    END IF;

  END IF;

  RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_reject_vtc_cash_payment
ON public.reservations;

CREATE TRIGGER trg_reject_vtc_cash_payment
BEFORE INSERT OR UPDATE
ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.reject_vtc_cash_payment();


-- ============================================================================
-- 20. PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.calculate_vtc_price(
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  integer
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.detect_vtc_zone(
  numeric,
  numeric
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.vtc_distance_km(
  numeric,
  numeric,
  numeric,
  numeric
) TO anon, authenticated;


-- ============================================================================
-- 21. RLS
-- ============================================================================

ALTER TABLE public.vtc_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vtc_pricing_rules ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "vtc_zones_read_authenticated"
ON public.vtc_zones;

CREATE POLICY "vtc_zones_read_authenticated"
ON public.vtc_zones
FOR SELECT
TO authenticated
USING (is_active = true);


DROP POLICY IF EXISTS "vtc_pricing_rules_read_authenticated"
ON public.vtc_pricing_rules;

CREATE POLICY "vtc_pricing_rules_read_authenticated"
ON public.vtc_pricing_rules
FOR SELECT
TO authenticated
USING (is_active = true);


-- ============================================================================
-- 22. VÉRIFICATIONS INTERNES
-- ============================================================================

DO $$
DECLARE
  _zone_count integer;
  _rule_count integer;
BEGIN

  SELECT count(*)
  INTO _zone_count
  FROM public.vtc_zones
  WHERE is_active = true;

  IF _zone_count < 7 THEN
    RAISE EXCEPTION
      'VTC_MIGRATION_ERROR: zones insuffisantes (%).',
      _zone_count;
  END IF;


  SELECT count(*)
  INTO _rule_count
  FROM public.vtc_pricing_rules
  WHERE is_active = true;

  IF _rule_count = 0 THEN
    RAISE EXCEPTION
      'VTC_MIGRATION_ERROR: aucune règle tarifaire créée.';
  END IF;

END;
$$;


-- ============================================================================
-- 23. FIN
-- ============================================================================

