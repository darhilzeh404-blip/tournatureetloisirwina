import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDriverPosition } from "@/hooks/use-driver-position";
import { LiveMap, type MapMarker } from "@/components/LiveMap";
import { useOsrmRoute } from "@/hooks/use-osrm-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Navigation } from "lucide-react";

export const Route = createFileRoute("/suivi/$tripId")({
  head: () => ({
    meta: [{ title: "Suivi en direct — Agence Wina" }],
  }),
  component: TripTrackingPage,
});

interface Trip {
  id: string;
  client_id: string;
  driver_id: string | null;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  status: string;
  eta_minutes: number | null;
}

function TripTrackingPage() {
  const { tripId } = Route.useParams();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState<string>("");

  const driverPos = useDriverPosition(trip?.driver_id ?? null);
  const fromPoint =
    driverPos && trip?.status === "active"
      ? { lat: Number(driverPos.latitude), lng: Number(driverPos.longitude) }
      : trip?.origin_lat && trip.origin_lng
      ? { lat: Number(trip.origin_lat), lng: Number(trip.origin_lng) }
      : null;
  const toPoint =
    trip?.destination_lat && trip.destination_lng
      ? { lat: Number(trip.destination_lat), lng: Number(trip.destination_lng) }
      : null;
  const refreshKey = driverPos
    ? `${Number(driverPos.latitude).toFixed(3)}-${Number(driverPos.longitude).toFixed(3)}`
    : "static";
  const { route: osrmRoute, loading: routeLoading } = useOsrmRoute(
    fromPoint,
    toPoint,
    Boolean(fromPoint && toPoint),
    refreshKey
  );

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/connexion" });
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .is("archived_at", null)
        .maybeSingle();
      if (!mounted) return;
      setTrip(data as Trip | null);
      if (data?.driver_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", data.driver_id)
          .maybeSingle();
        if (mounted && profile) setDriverName(profile.full_name);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        (payload) => {
          if (!mounted) return;
          const next = payload.new as Trip & { archived_at?: string | null };
          setTrip(next.archived_at || next.status === "completed" ? null : next);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [tripId, user]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Chargement...</div>;
  }
  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p>Course introuvable.</p>
        <Link to="/mes-reservations"><Button variant="outline">Retour</Button></Link>
      </div>
    );
  }

  const markers: MapMarker[] = [];
  if (trip.origin_lat && trip.origin_lng) {
    markers.push({
      id: "origin",
      lat: Number(trip.origin_lat),
      lng: Number(trip.origin_lng),
      type: "client",
      label: trip.origin_address || "Départ",
    });
  }
  if (trip.destination_lat && trip.destination_lng) {
    markers.push({
      id: "dest",
      lat: Number(trip.destination_lat),
      lng: Number(trip.destination_lng),
      type: "destination",
      label: trip.destination_address || "Destination",
    });
  }
  if (driverPos) {
    markers.push({
      id: "driver",
      lat: Number(driverPos.latitude),
      lng: Number(driverPos.longitude),
      type: "driver",
      label: driverName || "Chauffeur",
    });
  }

  const liveEta: number | null =
    osrmRoute && driverPos && trip.status === "active"
      ? osrmRoute.durationMin
      : trip.eta_minutes;

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: "En attente", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
    active: { label: "En cours", color: "bg-green-500/10 text-green-700 border-green-500/30" },
    completed: { label: "Terminée", color: "bg-muted text-muted-foreground" },
    cancelled: { label: "Annulée", color: "bg-red-500/10 text-red-700 border-red-500/30" },
  };
  const sl = statusLabel[trip.status] ?? { label: trip.status, color: "" };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card p-3">
        <Link to="/mes-reservations">
          <Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold truncate">Suivi en direct</h1>
          <p className="text-xs text-muted-foreground truncate">
            {trip.origin_address} → {trip.destination_address}
          </p>
        </div>
        <Badge className={sl.color}>{sl.label}</Badge>
      </header>

      <div className="flex-1 relative">
        {markers.length > 0 ? (
          <LiveMap
            markers={markers}
            showRoute
            routePath={osrmRoute?.geometry}
            followMarkerId={driverPos ? "driver" : undefined}
            height="100%"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground p-6 text-center">
            <div>
              <MapPin className="mx-auto h-12 w-12 opacity-30" />
              <p className="mt-2">Aucune coordonnée disponible pour cette course.</p>
            </div>
          </div>
        )}

        {/* Floating info panel */}
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border bg-card/95 backdrop-blur p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Chauffeur</p>
              <p className="font-semibold">
                {driverName || (trip.driver_id ? "Chauffeur assigné" : "Pas encore assigné")}
              </p>
            </div>
            {liveEta !== null && (trip.status === "active" || osrmRoute) && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> ETA
                </div>
                <p className="font-bold text-lg">
                  {routeLoading ? "…" : `${liveEta} min`}
                </p>
                {osrmRoute && (
                  <p className="text-[10px] text-muted-foreground">
                    {osrmRoute.distanceKm.toFixed(1)} km
                  </p>
                )}
              </div>
            )}
          </div>
          {!driverPos && trip.driver_id && trip.status === "active" && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              En attente de la position du chauffeur...
            </p>
          )}
          {trip.status === "pending" && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              La course n'a pas encore commencé.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
