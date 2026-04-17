import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TCategory = { id: string; slug: string; name: string; description: string; icon: string; sort_order: number };
export type TRoute = { id: string; category_id: string; name: string; origin: string; destination: string; distance_km: number; is_active: boolean };
export type TVehicle = { id: string; name: string; capacity: number; base_price: number; description: string; is_active: boolean };
export type TPricing = { id: string; route_id: string; vehicle_id: string; service_type: string; trip_type: string; price: number };
export type TActivity = { id: string; name: string; description: string; price: number; duration_hours: number; is_active: boolean };
export type TPackage = { id: string; name: string; description: string; route_id: string | null; activity_id: string | null; price: number; is_active: boolean };
export type TSetting = { id: string; key: string; value: number; label: string; description: string };

export type TransportData = {
  categories: TCategory[];
  routes: TRoute[];
  vehicles: TVehicle[];
  pricing: TPricing[];
  activities: TActivity[];
  packages: TPackage[];
  settings: Record<string, number>;
  loading: boolean;
  reload: () => Promise<void>;
};

export function useTransportData(): TransportData {
  const [data, setData] = useState<Omit<TransportData, "reload">>({
    categories: [], routes: [], vehicles: [], pricing: [], activities: [], packages: [],
    settings: {}, loading: true,
  });

  const load = async () => {
    setData(d => ({ ...d, loading: true }));
    const [c, r, v, p, a, pk, s] = await Promise.all([
      supabase.from("transport_categories").select("*").order("sort_order"),
      supabase.from("transport_routes").select("*"),
      supabase.from("transport_vehicles").select("*"),
      supabase.from("transport_pricing").select("*"),
      supabase.from("transport_activities").select("*"),
      supabase.from("transport_packages").select("*"),
      supabase.from("transport_settings").select("*"),
    ]);
    const settings: Record<string, number> = {};
    (s.data ?? []).forEach((row: any) => { settings[row.key] = Number(row.value); });
    setData({
      categories: (c.data ?? []) as TCategory[],
      routes: (r.data ?? []) as TRoute[],
      vehicles: (v.data ?? []) as TVehicle[],
      pricing: (p.data ?? []) as TPricing[],
      activities: (a.data ?? []) as TActivity[],
      packages: (pk.data ?? []) as TPackage[],
      settings, loading: false,
    });
  };

  useEffect(() => { load(); }, []);
  return { ...data, reload: load };
}

export type QuoteInput = {
  routeId: string;
  vehicleId: string;
  serviceType: "standard" | "vip";
  tripType: "aller_simple" | "aller_retour";
  childrenCount?: number;
  activityIds?: string[];
};

export type QuoteLine = { label: string; amount: number };
export type Quote = { lines: QuoteLine[]; total: number };

export function computeQuote(input: QuoteInput, d: TransportData): Quote {
  const lines: QuoteLine[] = [];
  const route = d.routes.find(r => r.id === input.routeId);
  const vehicle = d.vehicles.find(v => v.id === input.vehicleId);
  if (!route || !vehicle) return { lines, total: 0 };

  const tariff = d.pricing.find(p =>
    p.route_id === input.routeId &&
    p.vehicle_id === input.vehicleId &&
    p.service_type === input.serviceType &&
    p.trip_type === input.tripType
  );

  const base = tariff?.price ?? vehicle.base_price;
  lines.push({
    label: `${vehicle.name} — ${route.name} (${input.serviceType === "vip" ? "VIP" : "Standard"}, ${input.tripType === "aller_retour" ? "Aller-Retour" : "Aller simple"})`,
    amount: base,
  });

  if (input.childrenCount && input.childrenCount > 0) {
    const supp = (d.settings.child_supplement ?? 0) * input.childrenCount;
    if (supp > 0) lines.push({ label: `Supplément ${input.childrenCount} enfant(s)`, amount: supp });
  }

  (input.activityIds ?? []).forEach(aid => {
    const act = d.activities.find(a => a.id === aid);
    if (act) lines.push({ label: `Activité : ${act.name}`, amount: act.price });
  });

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total };
}

export function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}
