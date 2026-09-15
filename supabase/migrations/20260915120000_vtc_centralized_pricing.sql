-- ============================================================
-- WINA TOUR — VTC CENTRALIZED PRICING
-- Version corrigée
-- Source de vérité des tarifs : Supabase
-- Commission WINA : 10 %
-- Conducteur : 90 %
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ZONES VTC
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vtc_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_zone_id uuid REFERENCES public.vtc_zones(id) ON DELETE SET NULL,
  zone_type text NOT NULL CHECK (
    zone_type IN ('city', 'subzone', 'airport')
  ),
  min_lat numeric NOT NULL,
  max_lat numeric NOT NULL,
  min_lng numeric NOT NULL,
  max_lng numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vtc_zones_active
  ON public.vtc_zones(active);

CREATE INDEX IF NOT EXISTS idx_vtc_zones_code
  ON public.vtc_zones(code);

-- ============================================================
-- 2. RÈGLES TARIFAIRES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vtc_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pickup_zone text NOT NULL
    REFERENCES public.vtc_zones(code),

  destination_zone text NOT NULL
    REFERENCES public.vtc_zones(code),

  category text NOT NULL CHECK (
    category IN ('standard', 'confort', 'vip')
  ),

  mode text NOT NULL CHECK (
    mode IN ('express', 'hour')
  ),

  min_distance_km numeric NOT NULL DEFAULT 0,
  max_distance_km numeric,

  base_price integer NOT NULL CHECK (base_price >= 0),
  minimum_price integer NOT NULL CHECK (minimum_price >= 0),

  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vtc_pricing_distance_check
    CHECK (
      max_distance_km IS NULL
      OR max_distance_km >= min_distance_km
    )
);

CREATE INDEX IF NOT EXISTS idx_vtc_pricing_lookup
ON public.vtc_pricing_rules (
  pickup_zone,
  destination_zone,
  category,
  mode,
  active
);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE public.vtc_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vtc_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vtc_zones_select_authenticated"
ON public.vtc_zones;

CREATE POLICY "vtc_zones_select_authenticated"
ON public.vtc_zones
FOR SELECT
TO authenticated
USING (
  active = true
  OR public.is_admin()
);

DROP POLICY IF EXISTS "vtc_zones_admin_all"
ON public.vtc_zones;

CREATE POLICY "vtc_zones_admin_all"
ON public.vtc_zones
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "vtc_pricing_select_authenticated"
ON public.vtc_pricing_rules;

CREATE POLICY "vtc_pricing_select_authenticated"
ON public.vtc_pricing_rules
FOR SELECT
TO authenticated
USING (
  active = true
  OR public.is_admin()
);

DROP POLICY IF EXISTS "vtc_pricing_admin_all"
ON public.vtc_pricing_rules;

CREATE POLICY "vtc_pricing_admin_all"
ON public.vtc_pricing_rules
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- 4. ZONES
-- ============================================================

INSERT INTO public.vtc_zones (
  code,
  name,
  zone_type,
  min_lat,
  max_lat,
  min_lng,
  max_lng,
  active
)
VALUES

(
  'AKANDA',
  'Akanda',
  'city',
  0.5400,
  0.6300,
  9.3200,
  9.4900,
  true
),

(
  'LIBREVILLE_NORD',
  'Libreville Nord',
  'subzone',
  0.4550,
  0.5400,
  9.3700,
  9.5200,
  true
),

(
  'LIBREVILLE_CENTRE',
  'Libreville Centre',
  'subzone',
  0.4100,
  0.4550,
  9.3700,
  9.5200,
  true
),

(
  'LIBREVILLE_SUD',
  'Libreville Sud',
  'subzone',
  0.3700,
  0.4100,
  9.3700,
  9.5200,
  true
),

(
  'OWENDO',
  'Owendo',
  'city',
  0.2500,
  0.3700,
  9.4400,
  9.5400,
  true
),

(
  'NTOUM',
  'Ntoum',
  'city',
  0.3000,
  0.4700,
  9.6500,
  9.8500,
  true
),

(
  'AIRPORT',
  'Aéroport Léon-MBA',
  'airport',
  0.4450,
  0.4750,
  9.3900,
  9.4400,
  true
)

ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  zone_type = EXCLUDED.zone_type,
  min_lat = EXCLUDED.min_lat,
  max_lat = EXCLUDED.max_lat,
  min_lng = EXCLUDED.min_lng,
  max_lng = EXCLUDED.max_lng,
  active = EXCLUDED.active,
  updated_at = now();

-- ============================================================
-- 5. FONCTION DISTANCE HAVERSINE
-- ============================================================

CREATE OR REPLACE FUNCTION public.vtc_distance_km(
  _lat1 numeric,
  _lng1 numeric,
  _lat2 numeric,
  _lng2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r numeric := 6371;
  dlat numeric;
  dlng numeric;
  a numeric;
  c numeric;
BEGIN
  dlat := radians(_lat2 - _lat1);
  dlng := radians(_lng2 - _lng1);

  a :=
      sin(dlat / 2) * sin(dlat / 2)
      +
      cos(radians(_lat1))
      * cos(radians(_lat2))
      * sin(dlng / 2)
      * sin(dlng / 2);

  c := 2 * atan2(
    sqrt(a),
    sqrt(1 - a)
  );

  RETURN round((r * c)::numeric, 2);
END;
$$;

-- ============================================================
-- 6. NETTOYAGE DES ANCIENNES RÈGLES
-- ============================================================

DELETE FROM public.vtc_pricing_rules;

-- ============================================================
-- 7. TARIFS STANDARD — COURSES INTERNES
-- ============================================================

-- Akanda
INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES
('AKANDA','AKANDA','standard','express',0,5,2000,2000,10),
('AKANDA','AKANDA','standard','express',5,8,2500,2500,20),
('AKANDA','AKANDA','standard','express',8,NULL,3000,3000,30);

-- Libreville Nord
INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES
('LIBREVILLE_NORD','LIBREVILLE_NORD','standard','express',0,5,2000,2000,10),
('LIBREVILLE_NORD','LIBREVILLE_NORD','standard','express',5,8,2500,2500,20),
('LIBREVILLE_NORD','LIBREVILLE_NORD','standard','express',8,NULL,3000,3000,30);

-- Libreville Centre
INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES
('LIBREVILLE_CENTRE','LIBREVILLE_CENTRE','standard','express',0,5,2000,2000,10),
('LIBREVILLE_CENTRE','LIBREVILLE_CENTRE','standard','express',5,8,2500,2500,20),
('LIBREVILLE_CENTRE','LIBREVILLE_CENTRE','standard','express',8,NULL,3000,3000,30);

-- Libreville Sud
INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES
('LIBREVILLE_SUD','LIBREVILLE_SUD','standard','express',0,5,2000,2000,10),
('LIBREVILLE_SUD','LIBREVILLE_SUD','standard','express',5,8,2500,2500,20),
('LIBREVILLE_SUD','LIBREVILLE_SUD','standard','express',8,NULL,3000,3000,30);

-- Owendo
INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES
('OWENDO','OWENDO','standard','express',0,5,2000,2000,10),
('OWENDO','OWENDO','standard','express',5,8,2500,2500,20),
('OWENDO','OWENDO','standard','express',8,NULL,3000,3000,30);

-- Ntoum
INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES
('NTOUM','NTOUM','standard','express',0,5,2000,2000,10),
('NTOUM','NTOUM','standard','express',5,8,2500,2500,20),
('NTOUM','NTOUM','standard','express',8,NULL,3500,3500,30);

-- ============================================================
-- 8. AKANDA ↔ LIBREVILLE
-- ============================================================

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  a,
  b,
  'standard',
  'express',
  0,
  NULL,
  3000,
  3000,
  5
FROM unnest(ARRAY['AKANDA']) a
CROSS JOIN unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) b;

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  a,
  b,
  'standard',
  'express',
  0,
  NULL,
  3000,
  3000,
  5
FROM unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) a
CROSS JOIN unnest(ARRAY['AKANDA']) b;

-- ============================================================
-- 9. LIBREVILLE NORD ↔ CENTRE ↔ SUD
-- ============================================================

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES
('LIBREVILLE_NORD','LIBREVILLE_CENTRE','standard','express',0,NULL,3000,3000,5),
('LIBREVILLE_CENTRE','LIBREVILLE_NORD','standard','express',0,NULL,3000,3000,5),

('LIBREVILLE_CENTRE','LIBREVILLE_SUD','standard','express',0,NULL,3000,3000,5),
('LIBREVILLE_SUD','LIBREVILLE_CENTRE','standard','express',0,NULL,3000,3000,5),

('LIBREVILLE_NORD','LIBREVILLE_SUD','standard','express',0,NULL,3500,3500,5),
('LIBREVILLE_SUD','LIBREVILLE_NORD','standard','express',0,NULL,3500,3500,5);

-- ============================================================
-- 10. LIBREVILLE ↔ OWENDO
-- ============================================================

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  a,
  'OWENDO',
  'standard',
  'express',
  0,
  NULL,
  4000,
  4000,
  5
FROM unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) a;

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  'OWENDO',
  a,
  'standard',
  'express',
  0,
  NULL,
  4000,
  4000,
  5
FROM unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) a;

-- ============================================================
-- 11. LIBREVILLE ↔ NTOUM
-- ============================================================

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  a,
  'NTOUM',
  'standard',
  'express',
  0,
  NULL,
  5000,
  5000,
  5
FROM unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) a;

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  'NTOUM',
  a,
  'standard',
  'express',
  0,
  NULL,
  5000,
  5000,
  5
FROM unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) a;

-- ============================================================
-- 12. AUTRES GRANDES LIAISONS
-- ============================================================

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES

('AKANDA','OWENDO','standard','express',0,NULL,5000,5000,5),
('OWENDO','AKANDA','standard','express',0,NULL,5000,5000,5),

('AKANDA','NTOUM','standard','express',0,NULL,6000,6000,5),
('NTOUM','AKANDA','standard','express',0,NULL,6000,6000,5),

('OWENDO','NTOUM','standard','express',0,NULL,5500,5500,5),
('NTOUM','OWENDO','standard','express',0,NULL,5500,5500,5);

-- ============================================================
-- 13. AÉROPORT LÉON-MBA
-- ============================================================

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
VALUES

('AIRPORT','AIRPORT','standard','express',0,NULL,2000,2000,5),

('AKANDA','AIRPORT','standard','express',0,NULL,3500,3500,5),
('AIRPORT','AKANDA','standard','express',0,NULL,3500,3500,5),

('OWENDO','AIRPORT','standard','express',0,NULL,4500,4500,5),
('AIRPORT','OWENDO','standard','express',0,NULL,4500,4500,5),

('NTOUM','AIRPORT','standard','express',0,NULL,5000,5000,5),
('AIRPORT','NTOUM','standard','express',0,NULL,5000,5000,5);

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  a,
  'AIRPORT',
  'standard',
  'express',
  0,
  NULL,
  3000,
  3000,
  5
FROM unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) a;

INSERT INTO public.vtc_pricing_rules
(pickup_zone, destination_zone, category, mode,
 min_distance_km, max_distance_km, base_price, minimum_price, priority)
SELECT
  'AIRPORT',
  a,
  'standard',
  'express',
  0,
  NULL,
  3000,
  3000,
  5
FROM unnest(
  ARRAY[
    'LIBREVILLE_NORD',
    'LIBREVILLE_CENTRE',
    'LIBREVILLE_SUD'
  ]
) a;

-- ============================================================
-- 14. CONFORT
-- +30 % par rapport au Standard
-- ============================================================

INSERT INTO public.vtc_pricing_rules (
  pickup_zone,
  destination_zone,
  category,
  mode,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  priority,
  active
)
SELECT
  pickup_zone,
  destination_zone,
  'confort',
  mode,
  min_distance_km,
  max_distance_km,
  CEIL(base_price * 1.30 / 100.0) * 100,
  CEIL(minimum_price * 1.30 / 100.0) * 100,
  priority,
  active
FROM public.vtc_pricing_rules
WHERE category = 'standard';

-- ============================================================
-- 15. VIP
-- Pour le moment : tarif configurable séparément.
-- Base initiale = Standard x2
-- ============================================================

INSERT INTO public.vtc_pricing_rules (
  pickup_zone,
  destination_zone,
  category,
  mode,
  min_distance_km,
  max_distance_km,
  base_price,
  minimum_price,
  priority,
  active
)
SELECT
  pickup_zone,
  destination_zone,
  'vip',
  mode,
  min_distance_km,
  max_distance_km,
  base_price * 2,
  minimum_price * 2,
  priority,
  active
FROM public.vtc_pricing_rules
WHERE category = 'standard';

-- ============================================================
-- 16. DISTANCE + PRIX CENTRALISÉ
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_vtc_price(
  _pickup_lat numeric,
  _pickup_lng numeric,
  _destination_lat numeric,
  _destination_lng numeric,
  _category text DEFAULT 'standard',
  _mode text DEFAULT 'express',
  _billable_hours numeric DEFAULT 1
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pickup_code text;
  destination_code text;

  distance numeric;
  rule public.vtc_pricing_rules%ROWTYPE;

  amount integer;
  commission integer;
  driver integer;
BEGIN

  -- ----------------------------------------------------------
  -- Validation
  -- ----------------------------------------------------------

  IF _category NOT IN ('standard','confort','vip') THEN
    RAISE EXCEPTION 'VTC_INVALID_CATEGORY';
  END IF;

  IF _mode NOT IN ('express','hour') THEN
    RAISE EXCEPTION 'VTC_INVALID_MODE';
  END IF;

  -- ----------------------------------------------------------
  -- Détection zone départ
  -- Airport prioritaire
  -- ----------------------------------------------------------

  SELECT z.code
  INTO pickup_code
  FROM public.vtc_zones z
  WHERE z.active = true
    AND _pickup_lat BETWEEN z.min_lat AND z.max_lat
    AND _pickup_lng BETWEEN z.min_lng AND z.max_lng
  ORDER BY
    CASE
      WHEN z.zone_type = 'airport' THEN 0
      WHEN z.zone_type = 'subzone' THEN 1
      ELSE 2
    END,
    (z.max_lat - z.min_lat) * (z.max_lng - z.min_lng)
  LIMIT 1;

  -- ----------------------------------------------------------
  -- Détection zone destination
  -- ----------------------------------------------------------

  SELECT z.code
  INTO destination_code
  FROM public.vtc_zones z
  WHERE z.active = true
    AND _destination_lat BETWEEN z.min_lat AND z.max_lat
    AND _destination_lng BETWEEN z.min_lng AND z.max_lng
  ORDER BY
    CASE
      WHEN z.zone_type = 'airport' THEN 0
      WHEN z.zone_type = 'subzone' THEN 1
      ELSE 2
    END,
    (z.max_lat - z.min_lat) * (z.max_lng - z.min_lng)
  LIMIT 1;

  IF pickup_code IS NULL THEN
    RAISE EXCEPTION 'VTC_PICKUP_ZONE_NOT_FOUND';
  END IF;

  IF destination_code IS NULL THEN
    RAISE EXCEPTION 'VTC_DESTINATION_ZONE_NOT_FOUND';
  END IF;

  -- ----------------------------------------------------------
  -- Distance
  -- ----------------------------------------------------------

  distance := public.vtc_distance_km(
    _pickup_lat,
    _pickup_lng,
    _destination_lat,
    _destination_lng
  );

  -- ----------------------------------------------------------
  -- Règle tarifaire
  -- ----------------------------------------------------------

  SELECT r.*
  INTO rule
  FROM public.vtc_pricing_rules r
  WHERE r.active = true
    AND r.pickup_zone = pickup_code
    AND r.destination_zone = destination_code
    AND r.category = _category
    AND r.mode = _mode
    AND distance >= r.min_distance_km
    AND (
      r.max_distance_km IS NULL
      OR distance < r.max_distance_km
    )
  ORDER BY r.priority ASC
  LIMIT 1;

  -- ----------------------------------------------------------
  -- Si aucune règle exacte n'existe
  -- Pour les modes horaires, on utilisera la règle interne
  -- ----------------------------------------------------------

  IF rule.id IS NULL AND _mode = 'hour' THEN

    SELECT r.*
    INTO rule
    FROM public.vtc_pricing_rules r
    WHERE r.active = true
      AND r.pickup_zone = pickup_code
      AND r.destination_zone = pickup_code
      AND r.category = _category
      AND r.mode = 'express'
    ORDER BY r.priority DESC
    LIMIT 1;

  END IF;

  IF rule.id IS NULL THEN
    RAISE EXCEPTION
      'VTC_PRICING_RULE_NOT_FOUND: % -> %',
      pickup_code,
      destination_code;
  END IF;

  -- ----------------------------------------------------------
  -- Calcul
  -- ----------------------------------------------------------

  IF _mode = 'hour' THEN

    amount := GREATEST(
      CEIL(
        rule.base_price
        * GREATEST(COALESCE(_billable_hours,1),1)
      )::integer,
      rule.minimum_price
    );

  ELSE

    amount := GREATEST(
      rule.base_price,
      rule.minimum_price
    );

  END IF;

  -- ----------------------------------------------------------
  -- Commission WINA = 10 %
  -- ----------------------------------------------------------

  commission := FLOOR(amount * 0.10);

  driver := amount - commission;

  RETURN QUERY
  SELECT
    amount,
    commission,
    driver,
    'XAF'::text,
    rule.id,
    rule.pickup_zone || ' -> ' || rule.destination_zone,
    pickup_code,
    destination_code,
    distance;

END;
$$;

-- ============================================================
-- 17. PERMISSIONS RPC
-- ============================================================

REVOKE ALL
ON FUNCTION public.calculate_vtc_price(
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  numeric
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.calculate_vtc_price(
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  numeric
)
TO authenticated;

-- ============================================================
-- 18. COLONNES SNAPSHOT RÉSERVATION
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_reservations_vtc_pricing_rule
ON public.reservations(pricing_rule_id);

CREATE INDEX IF NOT EXISTS idx_reservations_vtc_zones
ON public.reservations(pickup_zone, destination_zone);

-- ============================================================
-- 19. RÉFÉRENCE VTC
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.vtc_reference_seq
START WITH 1
INCREMENT BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_vtc_reference_unique
ON public.reservations(reference_code)
WHERE service_type = 'vtc'
  AND reference_code IS NOT NULL;

-- ============================================================
-- 20. TRIGGER TARIFICATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_vtc_pricing_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pricing jsonb;
  details_data jsonb;

  payment_mode_value text;
  category_value text;
  mode_value text;
  billable_hours_value numeric;

  current_date_code text;
  sequence_number bigint;
BEGIN

  -- ----------------------------------------------------------
  -- Seulement VTC
  -- ----------------------------------------------------------

  IF lower(coalesce(NEW.service_type,'')) <> 'vtc' THEN
    RETURN NEW;
  END IF;

  details_data := COALESCE(NEW.details, '{}'::jsonb);

  payment_mode_value :=
    lower(
      coalesce(
        details_data ->> 'payment_mode',
        'wallet'
      )
    );

  -- ----------------------------------------------------------
  -- CASH INTERDIT EN VTC
  -- ----------------------------------------------------------

  IF payment_mode_value = 'cash' THEN
    RAISE EXCEPTION 'VTC_CASH_NOT_ALLOWED';
  END IF;

  -- ----------------------------------------------------------
  -- Si le prix est déjà figé, on ne le modifie pas
  -- ----------------------------------------------------------

  IF TG_OP = 'UPDATE'
     AND OLD.price_at_booking IS NOT NULL
     AND NEW.price_at_booking IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  -- ----------------------------------------------------------
  -- Catégorie
  -- ----------------------------------------------------------

  category_value :=
    lower(
      coalesce(
        details_data ->> 'category',
        'standard'
      )
    );

  IF category_value NOT IN ('standard','confort','vip') THEN
    category_value := 'standard';
  END IF;

  -- ----------------------------------------------------------
  -- Mode
  -- ----------------------------------------------------------

  mode_value :=
    lower(
      coalesce(
        details_data ->> 'mode',
        'express'
      )
    );

  IF mode_value NOT IN ('express','hour') THEN
    mode_value := 'express';
  END IF;

  billable_hours_value :=
    GREATEST(
      COALESCE(
        NULLIF(
          details_data ->> 'billable_hours',
          ''
        )::numeric,
        1
      ),
      1
    );

  -- ----------------------------------------------------------
  -- Vérification coordonnées
  -- ----------------------------------------------------------

  IF details_data ->> 'pickup_lat' IS NULL
     OR details_data ->> 'pickup_lng' IS NULL
     OR details_data ->> 'destination_lat' IS NULL
     OR details_data ->> 'destination_lng' IS NULL
  THEN
    RAISE EXCEPTION 'VTC_COORDINATES_REQUIRED';
  END IF;

  -- ----------------------------------------------------------
  -- Calcul centralisé
  -- ----------------------------------------------------------

  SELECT to_jsonb(x)
  INTO pricing
  FROM public.calculate_vtc_price(
    (details_data ->> 'pickup_lat')::numeric,
    (details_data ->> 'pickup_lng')::numeric,
    (details_data ->> 'destination_lat')::numeric,
    (details_data ->> 'destination_lng')::numeric,
    category_value,
    mode_value,
    billable_hours_value
  ) x;

  NEW.total_amount :=
    (pricing ->> 'total_client')::integer;

  NEW.price_at_booking :=
    (pricing ->> 'total_client')::integer;

  NEW.wina_commission_at_booking :=
    (pricing ->> 'wina_commission')::integer;

  NEW.driver_amount_at_booking :=
    (pricing ->> 'driver_amount')::integer;

  NEW.pricing_rule_id :=
    (pricing ->> 'pricing_rule_id')::uuid;

  NEW.pickup_zone :=
    pricing ->> 'pickup_zone';

  NEW.destination_zone :=
    pricing ->> 'destination_zone';

  NEW.distance_km :=
    (pricing ->> 'distance_km')::numeric;

  -- ----------------------------------------------------------
  -- NE PAS ÉCRASER payment_mode
  -- ----------------------------------------------------------

  NEW.details :=
    details_data
    || jsonb_build_object(
      'pricing_source', 'supabase',
      'pricing_category', category_value,
      'pricing_mode', mode_value,
      'price_at_booking',
        (pricing ->> 'total_client')::integer,
      'wina_commission_at_booking',
        (pricing ->> 'wina_commission')::integer,
      'driver_amount_at_booking',
        (pricing ->> 'driver_amount')::integer,
      'pickup_zone',
        pricing ->> 'pickup_zone',
      'destination_zone',
        pricing ->> 'destination_zone',
      'distance_km',
        (pricing ->> 'distance_km')::numeric
    );

  -- ----------------------------------------------------------
  -- Référence WINA
  -- ----------------------------------------------------------

  IF NEW.reference_code IS NULL
     OR NEW.reference_code = ''
  THEN

    current_date_code :=
      to_char(now(), 'YYMMDD');

    sequence_number :=
      nextval('public.vtc_reference_seq');

    NEW.reference_code :=
      'VTC-'
      || current_date_code
      || '-'
      || lpad(
        (sequence_number % 10000)::text,
        4,
        '0'
      );

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_vtc_pricing_snapshot
ON public.reservations;

CREATE TRIGGER trg_set_vtc_pricing_snapshot
BEFORE INSERT OR UPDATE
ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.set_vtc_pricing_snapshot();

-- ============================================================
-- 21. BLOCAGE CASH
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_vtc_cash_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

  IF lower(coalesce(NEW.service_type,'')) = 'vtc'
     AND lower(
       coalesce(
         NEW.details ->> 'payment_mode',
         ''
       )
     ) = 'cash'
  THEN
    RAISE EXCEPTION 'VTC_CASH_NOT_ALLOWED';
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

-- ============================================================
-- 22. CRÉDIT CONDUCTEUR
-- ============================================================

CREATE OR REPLACE FUNCTION public.credit_driver_earnings(
  _reservation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation_row public.reservations%ROWTYPE;
  driver_amount integer;
BEGIN

  SELECT *
  INTO reservation_row
  FROM public.reservations
  WHERE id = _reservation_id
  FOR UPDATE;

  IF reservation_row.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  IF lower(coalesce(reservation_row.service_type,'')) <> 'vtc' THEN
    RETURN;
  END IF;

  IF reservation_row.driver_id IS NULL THEN
    RAISE EXCEPTION 'VTC_DRIVER_NOT_ASSIGNED';
  END IF;

  IF reservation_row.driver_amount_at_booking IS NOT NULL THEN
    driver_amount :=
      reservation_row.driver_amount_at_booking;
  ELSE
    driver_amount :=
      reservation_row.total_amount
      - FLOOR(
          reservation_row.total_amount * 0.10
        );
  END IF;

  -- Éviter un double crédit
  IF COALESCE(
    reservation_row.driver_earnings_credited,
    false
  ) THEN
    RETURN;
  END IF;

  UPDATE public.reservations
  SET driver_earnings_credited = true
  WHERE id = reservation_row.id;

  -- Le mécanisme existant de portefeuille conducteur
  -- doit effectuer le crédit réel.
  -- Cette fonction ne recrée pas un système de wallet parallèle.

END;
$$;

-- ============================================================
-- 23. FIN
-- ============================================================

COMMIT;