import { supabase } from "@/integrations/supabase/client";

export type VtcPricingEstimate = {
  totalClient: number;
  winaCommission: number;
  driverAmount: number;
  currency: string;
  pricingRuleId: string;
  pricingRule: string;
  pickupZone: string;
  destinationZone: string;
  distanceKm: number;
};

type PricingRpc = (fn: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

export async function calculateVtcPrice(args: {
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  category: "standard" | "confort" | "vip";
  mode: "express" | "hour";
  billableHours?: number;
}): Promise<VtcPricingEstimate> {
  const rpc = supabase.rpc as unknown as PricingRpc;
  const { data, error } = await rpc("calculate_vtc_price", {
    _pickup_lat: args.pickup.lat,
    _pickup_lng: args.pickup.lng,
    _destination_lat: args.destination.lat,
    _destination_lng: args.destination.lng,
    _category: args.category,
    _mode: args.mode,
    _billable_hours: args.billableHours ?? 1,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("VTC_PRICING_EMPTY");
  return {
    totalClient: Number(row.total_client),
    winaCommission: Number(row.wina_commission),
    driverAmount: Number(row.driver_amount),
    currency: String(row.currency ?? "XAF"),
    pricingRuleId: String(row.pricing_rule_id),
    pricingRule: String(row.pricing_rule),
    pickupZone: String(row.pickup_zone),
    destinationZone: String(row.destination_zone),
    distanceKm: Number(row.distance_km),
  };
}
