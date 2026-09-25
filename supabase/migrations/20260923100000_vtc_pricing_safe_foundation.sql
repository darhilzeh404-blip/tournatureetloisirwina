-- WINA TOUR — VTC pricing foundation (safe replacement for the conflicting
-- 20260915 VTC migrations). Apply manually only after reviewing in SQL Editor.
--
-- Assumptions adopted on 2026-09-23:
--   * airport = a fixed 3,500 FCFA surcharge, once per ride;
--   * listed inter-zone amounts are Standard; Confort = x1.30, VIP = x2.00;
--   * regular WINA commission remains 10%; it is 0% on the 1st and 3rd
--     Sunday of each month (Africa/Libreville timezone).
-- All business values below are data rows and can be changed without changing
-- the calculate_vtc_price RPC contract used by the mobile app.

begin;

create table if not exists public.wina_vtc_zones (
  code text primary key,
  name text not null,
  min_lat numeric not null,
  max_lat numeric not null,
  min_lng numeric not null,
  max_lng numeric not null,
  priority integer not null default 10,
  active boolean not null default true,
  check (min_lat < max_lat),
  check (min_lng < max_lng)
);

create table if not exists public.wina_vtc_distance_pricing (
  category text not null check (category in ('standard', 'confort', 'vip')),
  min_km numeric not null,
  max_km numeric,
  base_price integer not null check (base_price >= 0),
  extra_price_per_km integer not null default 0 check (extra_price_per_km >= 0),
  primary key (category, min_km),
  check (max_km is null or max_km > min_km)
);

create table if not exists public.wina_vtc_interzone_pricing (
  zone_a text not null references public.wina_vtc_zones(code),
  zone_b text not null references public.wina_vtc_zones(code),
  standard_price integer not null check (standard_price >= 0),
  confort_price integer not null check (confort_price >= 0),
  vip_price integer not null check (vip_price >= 0),
  primary key (zone_a, zone_b),
  check (zone_a < zone_b)
);

create table if not exists public.wina_vtc_settings (
  key text primary key,
  integer_value integer not null check (integer_value >= 0)
);

-- Priority makes boundary handling deterministic: airport first, then named
-- zones, then METRO_FALLBACK. The fallback deliberately prevents empty areas
-- inside the WINA TOUR service envelope.
insert into public.wina_vtc_zones (code, name, min_lat, max_lat, min_lng, max_lng, priority)
values
  ('METRO_FALLBACK', 'Périmètre WINA TOUR', 0.2000, 0.7000, 9.2000, 10.0000, 1),
  ('OWENDO', 'Owendo', 0.2500, 0.3700, 9.4400, 9.5400, 50),
  ('LIBREVILLE_SUD', 'Libreville Sud', 0.3700, 0.4100, 9.3700, 9.5200, 60),
  ('LIBREVILLE_CENTRE', 'Libreville Centre', 0.4100, 0.4550, 9.3700, 9.5200, 60),
  ('LIBREVILLE_NORD', 'Libreville Nord', 0.4550, 0.5400, 9.3700, 9.5200, 60),
  ('AKANDA', 'Akanda', 0.5400, 0.6300, 9.3200, 9.4900, 70),
  ('NTOUM', 'Ntoum', 0.3000, 0.4700, 9.6500, 9.8500, 50),
  ('AIRPORT', 'Aéroport Léon-MBA', 0.4450, 0.4750, 9.3900, 9.4400, 100)
on conflict (code) do update set
  name = excluded.name,
  min_lat = excluded.min_lat,
  max_lat = excluded.max_lat,
  min_lng = excluded.min_lng,
  max_lng = excluded.max_lng,
  priority = excluded.priority,
  active = true;

insert into public.wina_vtc_distance_pricing (category, min_km, max_km, base_price, extra_price_per_km)
values
  ('standard', 0, 5, 2000, 0),
  ('standard', 5, 8, 2500, 0),
  ('standard', 8, 10, 3000, 0),
  ('standard', 10, null, 3000, 300),
  ('confort', 0, 5, 2600, 0),
  ('confort', 5, 8, 3300, 0),
  ('confort', 8, 10, 3900, 0),
  ('confort', 10, null, 3900, 390),
  ('vip', 0, 5, 4000, 0),
  ('vip', 5, 8, 5000, 0),
  ('vip', 8, 10, 6000, 0),
  ('vip', 10, null, 6000, 600)
on conflict (category, min_km) do update set
  max_km = excluded.max_km,
  base_price = excluded.base_price,
  extra_price_per_km = excluded.extra_price_per_km;

-- Pairs are stored alphabetically, so a price applies identically both ways.
insert into public.wina_vtc_interzone_pricing (zone_a, zone_b, standard_price, confort_price, vip_price)
values
  ('AKANDA', 'LIBREVILLE_NORD', 3000, 3900, 6000),
  ('AKANDA', 'LIBREVILLE_CENTRE', 3000, 3900, 6000),
  ('AKANDA', 'LIBREVILLE_SUD', 3000, 3900, 6000),
  ('LIBREVILLE_CENTRE', 'LIBREVILLE_NORD', 3000, 3900, 6000),
  ('LIBREVILLE_CENTRE', 'LIBREVILLE_SUD', 3000, 3900, 6000),
  ('LIBREVILLE_NORD', 'LIBREVILLE_SUD', 3500, 4600, 7000),
  ('LIBREVILLE_NORD', 'OWENDO', 4000, 5200, 8000),
  ('LIBREVILLE_CENTRE', 'OWENDO', 4000, 5200, 8000),
  ('LIBREVILLE_SUD', 'OWENDO', 4000, 5200, 8000),
  ('LIBREVILLE_NORD', 'NTOUM', 5000, 6500, 10000),
  ('LIBREVILLE_CENTRE', 'NTOUM', 5000, 6500, 10000),
  ('LIBREVILLE_SUD', 'NTOUM', 5000, 6500, 10000),
  ('AKANDA', 'OWENDO', 5000, 6500, 10000),
  ('AKANDA', 'NTOUM', 6000, 7800, 12000),
  ('NTOUM', 'OWENDO', 5500, 7200, 11000)
on conflict (zone_a, zone_b) do update set
  standard_price = excluded.standard_price,
  confort_price = excluded.confort_price,
  vip_price = excluded.vip_price;

insert into public.wina_vtc_settings (key, integer_value)
values
  ('airport_surcharge_fcfa', 3500),
  ('night_surcharge_percent', 20),
  ('hourly_price_fcfa', 5000),
  ('normal_commission_percent', 10)
on conflict (key) do update set integer_value = excluded.integer_value;

-- PostgreSQL cannot change the OUT-column shape of an existing function with
-- CREATE OR REPLACE. No CASCADE: if another object depends on this RPC the
-- migration stops safely and names the dependency instead of deleting it.
drop function if exists public.calculate_vtc_price(numeric, numeric, numeric, numeric, text, text, integer);

create or replace function public.calculate_vtc_price(
  _pickup_lat numeric,
  _pickup_lng numeric,
  _destination_lat numeric,
  _destination_lng numeric,
  _category text,
  _mode text,
  _billable_hours integer default 1
)
returns table (
  total_client integer,
  wina_commission integer,
  driver_amount integer,
  currency text,
  pricing_rule_id text,
  pricing_rule text,
  pickup_zone text,
  destination_zone text,
  distance_km numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _pickup_zone text;
  _destination_zone text;
  _distance numeric;
  _base integer;
  _extra integer := 0;
  _airport_surcharge integer;
  _night_percent integer;
  _hourly_price integer;
  _commission_percent integer;
  _is_free_commission_sunday boolean;
  _local_timestamp timestamp;
  _rule text;
begin
  if _category not in ('standard', 'confort', 'vip') then
    raise exception 'VTC_INVALID_CATEGORY';
  end if;
  if _mode not in ('express', 'hour') then
    raise exception 'VTC_INVALID_MODE';
  end if;

  select z.code into _pickup_zone
  from public.wina_vtc_zones z
  where z.active
    and _pickup_lat between z.min_lat and z.max_lat
    and _pickup_lng between z.min_lng and z.max_lng
  order by z.priority desc
  limit 1;

  select z.code into _destination_zone
  from public.wina_vtc_zones z
  where z.active
    and _destination_lat between z.min_lat and z.max_lat
    and _destination_lng between z.min_lng and z.max_lng
  order by z.priority desc
  limit 1;

  if _pickup_zone is null or _destination_zone is null then
    raise exception 'VTC_ZONE_NOT_COVERED';
  end if;

  _distance := 6371 * acos(least(1::numeric, greatest(-1::numeric,
    cos(radians(_pickup_lat)) * cos(radians(_destination_lat)) *
    cos(radians(_destination_lng) - radians(_pickup_lng)) +
    sin(radians(_pickup_lat)) * sin(radians(_destination_lat))
  )));

  select integer_value into _airport_surcharge from public.wina_vtc_settings where key = 'airport_surcharge_fcfa';
  select integer_value into _night_percent from public.wina_vtc_settings where key = 'night_surcharge_percent';
  select integer_value into _hourly_price from public.wina_vtc_settings where key = 'hourly_price_fcfa';
  select integer_value into _commission_percent from public.wina_vtc_settings where key = 'normal_commission_percent';

  if _mode = 'hour' then
    _base := _hourly_price * greatest(1, coalesce(_billable_hours, 1));
    _rule := format('hour-%sh', greatest(1, coalesce(_billable_hours, 1)));
  else
    select case _category
      when 'standard' then p.standard_price
      when 'confort' then p.confort_price
      else p.vip_price
    end into _base
    from public.wina_vtc_interzone_pricing p
    where p.zone_a = least(_pickup_zone, _destination_zone)
      and p.zone_b = greatest(_pickup_zone, _destination_zone);

    if _base is not null then
      _rule := format('interzone-%s-%s-%s', least(_pickup_zone, _destination_zone), greatest(_pickup_zone, _destination_zone), _category);
    else
      select p.base_price, p.extra_price_per_km into _base, _extra
      from public.wina_vtc_distance_pricing p
      where p.category = _category
        and _distance >= p.min_km
        and (p.max_km is null or _distance < p.max_km)
      order by p.min_km desc
      limit 1;
      if _base is null then raise exception 'VTC_PRICING_NOT_FOUND'; end if;
      if _distance > 10 then _base := _base + ceil(_distance - 10) * _extra; end if;
      _rule := format('distance-%s-%s', _category, floor(_distance));
    end if;
  end if;

  if _pickup_zone = 'AIRPORT' or _destination_zone = 'AIRPORT' then
    _base := _base + coalesce(_airport_surcharge, 0);
    _rule := _rule || '-airport';
  end if;

  _local_timestamp := now() at time zone 'Africa/Libreville';
  if extract(hour from _local_timestamp) >= 22 or extract(hour from _local_timestamp) < 6 then
    _base := ceil(_base * (100 + coalesce(_night_percent, 0)) / 100.0);
    _rule := _rule || '-night';
  end if;

  _is_free_commission_sunday := extract(dow from _local_timestamp) = 0
    and (extract(day from _local_timestamp) between 1 and 7 or extract(day from _local_timestamp) between 15 and 21);

  total_client := _base;
  wina_commission := case when _is_free_commission_sunday then 0 else floor(_base * coalesce(_commission_percent, 10) / 100.0) end;
  driver_amount := _base - wina_commission;
  currency := 'XAF';
  pricing_rule_id := _rule;
  pricing_rule := _rule;
  pickup_zone := _pickup_zone;
  destination_zone := _destination_zone;
  distance_km := round(_distance, 2);
  return next;
end;
$$;

revoke all on function public.calculate_vtc_price(numeric, numeric, numeric, numeric, text, text, integer) from public;
grant execute on function public.calculate_vtc_price(numeric, numeric, numeric, numeric, text, text, integer) to authenticated;

commit;
