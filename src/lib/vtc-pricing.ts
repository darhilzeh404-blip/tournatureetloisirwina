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

export async function calculateVtcPrice(args: {
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  category: "standard" | "confort" | "vip";
  mode: "express" | "hour";
  billableHours?: number;
}): Promise<VtcPricingEstimate> {
  const rpcArgs = {
    _pickup_lat: Number(args.pickup.lat),
    _pickup_lng: Number(args.pickup.lng),
    _destination_lat: Number(args.destination.lat),
    _destination_lng: Number(args.destination.lng),
    _category: args.category,
    _mode: args.mode,
    _billable_hours: Number(args.billableHours ?? 1),
  };

  console.log("[VTC PRICING] Appel RPC", {
    function: "calculate_vtc_price",
    args: rpcArgs,
  });

  const { data, error } = await (supabase.rpc as any)(
    "calculate_vtc_price",
    rpcArgs,
  );

  console.log("[VTC PRICING] Réponse RPC", {
    data,
    error,
  });

  if (error) {
    console.error("[VTC PRICING] ERREUR RPC :", error);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  console.log("[VTC PRICING] Ligne tarifaire :", row);

  if (!row) {
    console.error(
      "[VTC PRICING] RPC vide : aucune ligne retournée",
    );
    throw new Error("VTC_PRICING_EMPTY");
  }

  const result: VtcPricingEstimate = {
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

  console.log("[VTC PRICING] Tarif final :", result);

  return result;
}