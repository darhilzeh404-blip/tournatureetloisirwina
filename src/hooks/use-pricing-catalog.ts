import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SchoolTripTariff = { route_label: string; standing: "standard" | "vip"; formule: "simple" | "ar"; amount: number; sort_order: number };
export type SchoolMonthlyTariff = { standing: "standard" | "vip"; formule: "simple" | "ar"; amount: number };
export type ExtraActivity = { id: string; code: string; label: string; emoji: string | null; price: number; sort_order: number };
export type DirectionGroupBusPricing = { type: "direction"; aller: number; retour: number };
export type DailyGroupBusPricing = { type: "daily"; byCapacity: Record<string, number> };
export type GroupBusPricing = DirectionGroupBusPricing | DailyGroupBusPricing;

export const isDirectionPricing = (p: GroupBusPricing | undefined | null): p is DirectionGroupBusPricing =>
  !!p && p.type === "direction";
export const isDailyPricing = (p: GroupBusPricing | undefined | null): p is DailyGroupBusPricing =>
  !!p && p.type === "daily";

/** Safe lookup for daily bus pricing by capacity. Returns 0 if not daily or missing. */
export function getDailyBusPrice(pricing: GroupBusPricing | undefined | null, capacity: number | string): number {
  if (!isDailyPricing(pricing)) return 0;
  return Number(pricing.byCapacity[String(capacity)] ?? 0);
}

/** Safe lookup for direction bus pricing (aller / retour / aller_retour). Returns 0 if not directional. */
export function getDirectionBusPrice(
  pricing: GroupBusPricing | undefined | null,
  direction: "aller" | "retour" | "aller_retour",
): number {
  if (!isDirectionPricing(pricing)) return 0;
  if (direction === "aller_retour") return pricing.aller + pricing.retour;
  return pricing[direction];
}
export type GroupBusTrip = {
  id: string;
  code: string;
  title: string;
  gathering: string;
  note: string | null;
  destinations: string[];
  pricing: GroupBusPricing;
  sort_order: number;
};
export type EventBusTariff = { standing: "standard" | "vip"; formule: "journee" | "demi"; amount: number };
export type EventBusCapacityFactor = { capacity: number; factor: number };

export type PricingCatalog = {
  schoolTrips: SchoolTripTariff[];
  schoolMonthly: SchoolMonthlyTariff[];
  extraActivities: ExtraActivity[];
  groupBusTrips: GroupBusTrip[];
  eventBusTariffs: EventBusTariff[];
  eventBusCapacityFactors: EventBusCapacityFactor[];
  settings: Record<string, number>;
  loading: boolean;
  error: string | null;
};

export function usePricingCatalog(): PricingCatalog {
  const [state, setState] = useState<Omit<PricingCatalog, never>>({
    schoolTrips: [], schoolMonthly: [], extraActivities: [], groupBusTrips: [],
    eventBusTariffs: [], eventBusCapacityFactors: [], settings: {},
    loading: true, error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, m, a, g, e, c, s] = await Promise.all([
          supabase.from("school_trip_tariffs").select("*").order("sort_order"),
          supabase.from("school_monthly_tariffs").select("*"),
          supabase.from("extra_activities").select("*").eq("is_active", true).order("sort_order"),
          supabase.from("group_bus_trips").select("*").eq("is_active", true).order("sort_order"),
          supabase.from("event_bus_tariffs").select("*"),
          supabase.from("event_bus_capacity_factors").select("*").order("capacity"),
          supabase.from("transport_misc_settings").select("*"),
        ]);
        if (cancelled) return;
        const settings: Record<string, number> = {};
        (s.data ?? []).forEach((r: any) => { settings[r.key] = Number(r.value_int); });
        const err = t.error || m.error || a.error || g.error || e.error || c.error || s.error;
        setState({
          schoolTrips: (t.data ?? []) as any,
          schoolMonthly: (m.data ?? []) as any,
          extraActivities: (a.data ?? []) as any,
          groupBusTrips: (g.data ?? []).map((r: any) => ({ ...r, destinations: r.destinations ?? [] })) as any,
          eventBusTariffs: (e.data ?? []) as any,
          eventBusCapacityFactors: (c.data ?? []).map((r: any) => ({ capacity: Number(r.capacity), factor: Number(r.factor) })) as any,
          settings,
          loading: false,
          error: err ? err.message : null,
        });
      } catch (err) {
        if (!cancelled) {
          console.error("[usePricingCatalog] fetch error:", err);
          setState(prev => ({ ...prev, loading: false, error: "Erreur lors du chargement des tarifs" }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state as PricingCatalog;
}

export function findSchoolMonthly(rows: SchoolMonthlyTariff[], standing: "standard" | "vip", formule: "simple" | "ar"): number {
  return rows.find(r => r.standing === standing && r.formule === formule)?.amount ?? 0;
}

export function findEventBus(rows: EventBusTariff[], standing: "standard" | "vip", formule: "journee" | "demi"): number {
  return rows.find(r => r.standing === standing && r.formule === formule)?.amount ?? 0;
}

export function findCapacityFactor(rows: EventBusCapacityFactor[], capacity: number): number {
  return rows.find(r => r.capacity === capacity)?.factor ?? 1;
}
