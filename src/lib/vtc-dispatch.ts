import { supabase } from "@/integrations/supabase/client";

/** Haversine distance in km between two GPS coordinates. */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface NearbyDriver {
  driver_id: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  last_seen_at: string;
}

export interface DispatchResult {
  nearbyCount: number;
  drivers: NearbyDriver[];
  status: "pending" | "no_driver_found" | string;
}

/**
 * Trigger a search for VTC drivers within 5 km of the trip pickup.
 *
 * The actual driver notification is handled by Supabase Realtime: every online
 * VTC driver in `chauffeur-vtc.tsx` subscribes to `INSERT`s on `trips` and
 * filters by haversine ≤ 5 km against their own GPS position — so simply
 * creating the trip row already fans out the request.
 *
 * This function is the "post-flight check": it queries the SECURITY DEFINER
 * RPC to count how many online drivers are within range. If none, the trip is
 * flipped to `status = 'no_driver_found'` so the client UI can show a message
 * (and retry / cancel) instead of spinning forever.
 */
export async function triggerDriverSearch(
  tripId: string,
  pickupLat: number,
  pickupLng: number,
): Promise<DispatchResult> {
  try {
    // 1. Read the nearby drivers list (server-side haversine, respects RLS via SECURITY DEFINER).
    const { data: drivers, error: searchErr } = await supabase.rpc(
      "find_nearby_vtc_drivers",
      { _pickup_lat: pickupLat, _pickup_lng: pickupLng, _radius_km: 5 },
    );
    if (searchErr) {
      console.error("[vtc-dispatch] find_nearby_vtc_drivers", searchErr);
      throw searchErr;
    }

    // 2. Dispatch: lets the server mark `no_driver_found` atomically when empty.
    const { data: dispatchData, error: dispatchErr } = await supabase.rpc(
      "trigger_driver_search",
      { _trip_id: tripId },
    );
    if (dispatchErr) {
      console.error("[vtc-dispatch] trigger_driver_search", dispatchErr);
      throw dispatchErr;
    }

    const row = Array.isArray(dispatchData) ? dispatchData[0] : dispatchData;
    return {
      nearbyCount: Number(row?.nearby_count ?? drivers?.length ?? 0),
      drivers: (drivers ?? []) as NearbyDriver[],
      status: (row?.status ?? "pending") as string,
    };
  } catch (err) {
    console.error("[vtc-dispatch] triggerDriverSearch exception:", err);
    throw err;
  }
}
