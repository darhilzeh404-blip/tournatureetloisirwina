import { supabase } from "@/integrations/supabase/client";

export const BOAT_CATEGORY_SLUG = "bateau";

export type BoatRoute = {
  id: string;
  agency_id: string;
  origin: string;
  destination: string;
  distance_km: number;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
};

export type Vessel = {
  id: string;
  agency_id: string;
  name: string;
  photo_url: string | null;
  capacity: number;
  description: string;
  price_adult: number;
  price_child: number;
  price_infant: number;
  baggage_free_count: number;
  baggage_fee_per_extra: number;
  baggage_max_count: number;
  baggage_adult_kg: number;
  baggage_child_kg: number;
  baggage_infant_kg: number;
  fee_per_extra_kg: number;
  baggage_conditions: string;
  is_active: boolean;
  sort_order: number;
};

export type VesselService = {
  id: string;
  vessel_id: string;
  name: string;
  icon: string;
  price: number;
  is_active: boolean;
  sort_order: number;
};

export type BoatSailing = {
  id: string;
  vessel_id: string;
  route_id: string;
  departure_date: string | null;
  period_start: string | null;
  period_end: string | null;
  departure_time: string;
  price_adult: number;
  price_child: number;
  price_infant: number;
  seats_total: number;
  seats_available: number;
  status: "active" | "full" | "cancelled";
};

export type PassengerCategory = "adult" | "child" | "infant";

export const PASSENGER_LABEL: Record<PassengerCategory, string> = {
  adult: "Adulte (+12 ans)",
  child: "Enfant (2–12 ans)",
  infant: "Bébé (−2 ans)",
};

export type BoatPassengerInput = {
  category: PassengerCategory;
  last_name: string;
  first_name: string;
  email: string;
  phone: string;
  id_document: string;
};

export const formatDuration = (minutes: number) => {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m} min`;
};

export async function fetchBoatRoutes(agencyId?: string) {
  let q = supabase.from("boat_routes" as any).select("*").order("sort_order");
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  return ((data as any) ?? []) as BoatRoute[];
}

export async function fetchVessels(agencyId?: string) {
  let q = supabase.from("vessels" as any).select("*").order("sort_order");
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  return ((data as any) ?? []) as Vessel[];
}

export async function fetchVesselServices(vesselIds?: string[]) {
  let q = supabase.from("vessel_services" as any).select("*").order("sort_order");
  if (vesselIds && vesselIds.length > 0) q = q.in("vessel_id", vesselIds);
  const { data } = await q;
  return ((data as any) ?? []) as VesselService[];
}

/** Récupère les départs. Un départ couvre soit une date précise, soit une période (mois disponible). */
export async function fetchSailings(params: { routeId?: string; date?: string; vesselIds?: string[] }) {
  let q = supabase.from("boat_sailings" as any).select("*").order("departure_time");
  if (params.routeId) q = q.eq("route_id", params.routeId);
  if (params.vesselIds && params.vesselIds.length > 0) q = q.in("vessel_id", params.vesselIds);
  const { data } = await q;
  const list = ((data as any) ?? []) as BoatSailing[];
  if (!params.date) return list;
  return list.filter((s) => coversDate(s, params.date!));
}

/** Vrai si le départ est disponible à cette date (date fixe ou période administrée). */
export function coversDate(s: BoatSailing, date: string) {
  if (s.period_start && s.period_end) return date >= s.period_start && date <= s.period_end;
  return s.departure_date === date;
}

/** Prix effectifs : ceux du navire en priorité, sinon ceux du départ. */
export function effectivePrices(vessel: Vessel | null, sailing: BoatSailing | null) {
  return {
    adult: vessel?.price_adult || sailing?.price_adult || 0,
    child: vessel?.price_child || sailing?.price_child || 0,
    infant: vessel?.price_infant || sailing?.price_infant || 0,
  };
}

/** Bagages inclus (en nombre) pour l'ensemble des voyageurs payants. */
export function baggageIncluded(vessel: Vessel | null, adults: number, children: number) {
  if (!vessel) return 0;
  return (vessel.baggage_free_count ?? 0) * (adults + children);
}

export type BoatQuoteInput = {
  sailing: BoatSailing | null;
  vessel: Vessel | null;
  adults: number;
  children: number;
  infants: number;
  extraBaggage: number;
  feePerExtraBaggage: number;
  services: VesselService[];
  roundTrip: boolean;
};

export type BoatQuote = {
  lines: { label: string; amount: number }[];
  total: number;
  travellers: number;
};

export function computeBoatQuote(input: BoatQuoteInput): BoatQuote {
  const { sailing, vessel, adults, children, infants, extraBaggage, feePerExtraBaggage, services, roundTrip } = input;
  const lines: { label: string; amount: number }[] = [];
  const legs = roundTrip ? 2 : 1;
  const p = effectivePrices(vessel, sailing);

  if (adults > 0) {
    lines.push({ label: `Adultes × ${adults}${roundTrip ? " (aller-retour)" : ""}`, amount: p.adult * adults * legs });
  }
  if (children > 0) {
    lines.push({ label: `Enfants × ${children}${roundTrip ? " (aller-retour)" : ""}`, amount: p.child * children * legs });
  }
  if (infants > 0) {
    lines.push({ label: `Bébés × ${infants}${roundTrip ? " (aller-retour)" : ""}`, amount: p.infant * infants * legs });
  }

  if (extraBaggage > 0 && feePerExtraBaggage > 0) {
    lines.push({ label: `Bagages supplémentaires × ${extraBaggage}`, amount: extraBaggage * feePerExtraBaggage });
  }

  services.forEach((s) => {
    if (s.price > 0) lines.push({ label: `Service : ${s.name}`, amount: s.price });
  });

  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
    travellers: adults + children + infants,
  };
}

export function baggageAllowance(vessel: Vessel | null, adults: number, children: number, infants: number) {
  if (!vessel) return 0;
  return (
    vessel.baggage_adult_kg * adults +
    vessel.baggage_child_kg * children +
    vessel.baggage_infant_kg * infants
  );
}
