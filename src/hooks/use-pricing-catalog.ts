import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SchoolTripTariff = { route_label: string; standing: "standard" | "vip"; formule: "simple" | "ar"; amount: number; sort_order: number };
export type SchoolMonthlyTariff = { standing: "standard" | "vip"; formule: "simple" | "ar"; amount: number };
export type ExtraActivity = { id: string; code: string; label: string; emoji: string | null; price: number; sort_order: number };
export type GroupBusPricing =
  | { type: "direction"; aller: number; retour: number }
  | { type: "daily"; byCapacity: Record<string, number> };
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
