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
