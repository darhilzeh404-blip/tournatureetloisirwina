import { supabase } from "@/integrations/supabase/client";

export const TRAIN_CATEGORY_SLUG = "train";

export type TrainType = {
  id: string;
  name: string;
  code: string;
  station_kind: "principale" | "secondaire";
  description: string;
  is_active: boolean;
  sort_order: number;
};

export type TrainStation = {
  id: string;
  name: string;
  city: string;
  station_kind: "principale" | "secondaire";
  is_active: boolean;
  sort_order: number;
};

export type TrainClass = {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
};

export type TrainDiscountRule = {
  id: string;
  label: string;
  applies_to: "main" | "child";
  min_age: number | null;
  max_age: number | null;
  percent: number;
  is_active: boolean;
  sort_order: number;
};

export type TrainTicketClass = {
  id: string;
  ticket_id: string;
  class_id: string;
  price: number;
};

export const STATION_KIND_LABEL: Record<TrainStation["station_kind"], string> = {
  principale: "Gare principale",
  secondaire: "Gare secondaire",
};

export async function fetchTrainReference() {
  const [types, stations, classes, discounts] = await Promise.all([
    supabase.from("train_types" as any).select("*").order("sort_order"),
    supabase.from("train_stations" as any).select("*").order("sort_order").order("name"),
    supabase.from("train_travel_classes" as any).select("*").order("sort_order"),
    supabase.from("train_discount_rules" as any).select("*").order("sort_order"),
  ]);
  return {
    types: ((types.data as any) ?? []) as TrainType[],
    stations: ((stations.data as any) ?? []) as TrainStation[],
    classes: ((classes.data as any) ?? []) as TrainClass[],
    discounts: ((discounts.data as any) ?? []) as TrainDiscountRule[],
  };
}

export async function fetchTicketClassPrices(ticketIds: string[]) {
  if (!ticketIds.length) return [] as TrainTicketClass[];
  const { data } = await supabase
    .from("train_ticket_classes" as any)
    .select("id, ticket_id, class_id, price")
    .in("ticket_id", ticketIds);
  return ((data as any) ?? []) as TrainTicketClass[];
}

function matchRule(rule: TrainDiscountRule, age: number) {
  if (!rule.is_active) return false;
  if (rule.min_age !== null && age < rule.min_age) return false;
  if (rule.max_age !== null && age > rule.max_age) return false;
  return true;
}

export type DiscountLine = { label: string; amount: number };

export type TrainQuote = {
  travellers: number;
  grossTotal: number;
  discountLines: DiscountLine[];
  discountTotal: number;
  total: number;
};

/**
 * Prix normal, réductions automatiques (voyageur principal + enfants), total à payer.
 * Toutes les règles proviennent de la base (aucune valeur codée en dur).
 */
export function computeTrainQuote(
  unitPrice: number,
  mainAge: number | null,
  childrenAges: number[],
  rules: TrainDiscountRule[],
): TrainQuote {
  const mainRules = rules.filter((r) => r.applies_to === "main");
  const childRules = rules.filter((r) => r.applies_to === "child");

  const travellers = 1 + childrenAges.length;
  const grossTotal = unitPrice * travellers;
  const lines: DiscountLine[] = [];

  if (mainAge !== null && !Number.isNaN(mainAge)) {
    const rule = mainRules.find((r) => matchRule(r, mainAge));
    if (rule) {
      const amount = Math.round((unitPrice * rule.percent) / 100);
      if (amount > 0) lines.push({ label: `${rule.label} (−${rule.percent}%)`, amount });
    }
  }

  childrenAges.forEach((age, i) => {
    if (Number.isNaN(age)) return;
    const rule = childRules.find((r) => matchRule(r, age));
    if (rule) {
      const amount = Math.round((unitPrice * rule.percent) / 100);
      if (amount > 0) lines.push({ label: `Enfant ${i + 1} — ${rule.label} (−${rule.percent}%)`, amount });
    }
  });

  const discountTotal = lines.reduce((s, l) => s + l.amount, 0);
  return {
    travellers,
    grossTotal,
    discountLines: lines,
    discountTotal,
    total: Math.max(0, grossTotal - discountTotal),
  };
}

/* ------------------------------------------------------------------ */
/* Dessertes (routes) et bagages — 100 % administrables depuis la base */
/* ------------------------------------------------------------------ */

export type TrainRoute = {
  id: string;
  train_type_id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

export type TrainRouteStation = {
  id: string;
  route_id: string;
  station_id: string;
  stop_order: number;
};

export type TrainBaggageRule = {
  id: string;
  train_type_id: string | null;
  label: string;
  conditions: string;
  free_count: number;
  fee_per_extra: number;
  max_count: number;
  is_active: boolean;
  sort_order: number;
};

export const ID_DOCUMENT_TYPES = [
  { value: "cni", label: "Carte Nationale d'Identité" },
  { value: "passeport", label: "Passeport" },
  { value: "carte_sejour", label: "Carte de séjour" },
] as const;

export const CHILD_MIN_AGE = 4;
export const CHILD_MAX_AGE = 11;

export async function fetchTrainRoutes() {
  const [routes, links, rules] = await Promise.all([
    supabase.from("train_routes" as any).select("*").order("sort_order"),
    supabase.from("train_route_stations" as any).select("*").order("stop_order"),
    supabase.from("train_baggage_rules" as any).select("*").order("sort_order"),
  ]);
  return {
    routes: ((routes.data as any) ?? []) as TrainRoute[],
    routeStations: ((links.data as any) ?? []) as TrainRouteStation[],
    baggageRules: ((rules.data as any) ?? []) as TrainBaggageRule[],
  };
}

/**
 * Gares desservies par un type de train.
 * Priorité aux dessertes configurées ; sinon repli sur le type de gare du train
 * (train « principale » = gares principales, train « secondaire » = toutes les gares).
 */
export function stationsForTrainType(
  type: TrainType | undefined,
  stations: TrainStation[],
  routes: TrainRoute[],
  routeStations: TrainRouteStation[],
): TrainStation[] {
  const active = stations.filter((s) => s.is_active);
  if (!type) return active;
  const typeRoutes = routes.filter((r) => r.is_active && r.train_type_id === type.id);
  if (typeRoutes.length > 0) {
    const ids = new Set(
      routeStations.filter((rs) => typeRoutes.some((r) => r.id === rs.route_id)).map((rs) => rs.station_id),
    );
    const list = active.filter((s) => ids.has(s.id));
    if (list.length > 0) return list;
  }
  if (type.station_kind === "principale") return active.filter((s) => s.station_kind === "principale");
  return active;
}

export function baggageRuleForType(type: TrainType | undefined, rules: TrainBaggageRule[]) {
  const active = rules.filter((r) => r.is_active);
  return active.find((r) => type && r.train_type_id === type.id) ?? active.find((r) => r.train_type_id === null) ?? null;
}

export function computeBaggageFee(rule: TrainBaggageRule | null, count: number) {
  if (!rule || count <= 0) return 0;
  const extra = Math.max(0, count - rule.free_count);
  return Math.round(extra * rule.fee_per_extra);
}
