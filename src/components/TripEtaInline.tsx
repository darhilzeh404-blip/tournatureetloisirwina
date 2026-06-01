import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDriverPosition } from "@/hooks/use-driver-position";
import { EtaBadge } from "@/components/EtaBadge";

interface TripRow {
  driver_id: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  status: string;
}

/**
 * Petit badge ETA temps réel pour la liste "Mes réservations".
 * Affiche le temps estimé du chauffeur vers le pickup (pending) ou
 * du chauffeur vers la destination (active).
 */
export function TripEtaInline({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<TripRow | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("trips")
      .select("driver_id, origin_lat, origin_lng, destination_lat, destination_lng, status")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setTrip((data as TripRow) ?? null);
      });

    const channel = supabase
      .channel(`trip-eta-${tripId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        (payload) => {
          if (mounted) setTrip(payload.new as TripRow);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const driverPos = useDriverPosition(trip?.driver_id ?? null);

  if (!trip || !driverPos) return null;

  const from = { lat: Number(driverPos.latitude), lng: Number(driverPos.longitude) };
  const toActive =
    trip.status === "active" && trip.destination_lat && trip.destination_lng
      ? { lat: Number(trip.destination_lat), lng: Number(trip.destination_lng) }
      : null;
  const toPickup =
    trip.origin_lat && trip.origin_lng
      ? { lat: Number(trip.origin_lat), lng: Number(trip.origin_lng) }
      : null;

  const to = toActive ?? toPickup;
  if (!to) return null;

  const label = trip.status === "active" ? "Arrivée" : "Chauffeur";
  return <EtaBadge from={from} to={to} label={label} showArrival />;
}
