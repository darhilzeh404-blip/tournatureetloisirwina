import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useClientPosition } from "@/hooks/use-client-position";
import { LiveMap, type MapMarker } from "@/components/LiveMap";
import { useOsrmRoute } from "@/hooks/use-osrm-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, ArrowLeft, MapPin, Navigation, Play, Flag, CheckCircle, Radio, RadioTower } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chauffeur/trips")({
  head: () => ({ meta: [{ title: "Mes courses — Chauffeur" }] }),
  component: DriverTripsPage,
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
}

function DriverTripsPage() {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [clientName, setClientName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || (role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, user, role, navigate]);

  const trip = activeTrip ?? trips[0] ?? null;

  // Suit la position GPS du client (live)
  const clientPos = useClientPosition(trip?.client_id ?? null);

  const loadTrips = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("trips")
      .select("*")
      .eq("driver_id", user.id)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false });
    const list = (data as Trip[]) || [];
    setTrips(list);
    const active = list.find((t) => t.status === "active") ?? list[0] ?? null;
    setActiveTrip(active);
    if (active) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", active.client_id)
        .maybeSingle();
      if (profile) setClientName(profile.full_name);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadTrips();
    const channel = supabase
      .channel("driver-trips")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `driver_id=eq.${user.id}` },
        () => loadTrips()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadTrips]);

  const startTrip = async (t: Trip) => {
    setActionLoading(true);
    const { error } = await supabase
      .from("trips")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", t.id);
    setActionLoading(false);
    if (error) toast.error("Impossible de démarrer la course.");
    else toast.success("Course démarrée. Suivi du client activé.");
  };

  const completeTrip = async (t: Trip) => {
    setActionLoading(true);
    const { error } = await supabase
      .from("trips")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", t.id);
    setActionLoading(false);
    if (error) toast.error("Erreur lors de la finalisation.");
    else toast.success("Course terminée.");
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Chargement...</div>;
  if (!user) return null;

  // Markers : position du client (live), point de départ prévu, destination
  const markers: MapMarker[] = [];
  if (trip) {
    if (trip.destination_lat && trip.destination_lng)
      markers.push({ id: "dest", lat: Number(trip.destination_lat), lng: Number(trip.destination_lng), type: "destination", label: trip.destination_address });
    if (clientPos) {
      markers.push({ id: "client", lat: Number(clientPos.latitude), lng: Number(clientPos.longitude), type: "client", label: clientName || "Client (live)" });
    } else if (trip.origin_lat && trip.origin_lng) {
      markers.push({ id: "origin", lat: Number(trip.origin_lat), lng: Number(trip.origin_lng), type: "client", label: trip.origin_address });
    }
  }

  // Itinéraire OSRM : départ chauffeur (position client si dispo, sinon origin) → destination
  const fromPoint = clientPos
    ? { lat: Number(clientPos.latitude), lng: Number(clientPos.longitude) }
    : trip?.origin_lat && trip?.origin_lng
    ? { lat: Number(trip.origin_lat), lng: Number(trip.origin_lng) }
    : null;
  const toPoint = trip?.destination_lat && trip?.destination_lng
    ? { lat: Number(trip.destination_lat), lng: Number(trip.destination_lng) }
    : null;

  const refreshKey = clientPos
    ? `${Number(clientPos.latitude).toFixed(3)}-${Number(clientPos.longitude).toFixed(3)}`
    : "static";

  const { route: osrmRoute, loading: routeLoading } = useOsrmRoute(
    fromPoint,
    toPoint,
    Boolean(fromPoint && toPoint),
    refreshKey
  );

  const tracking = !!clientPos;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card p-3">
        <Link to="/chauffeur">
          <Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold flex items-center gap-2"><Truck className="h-5 w-5" /> Mes courses</h1>
          <p className="text-xs text-muted-foreground">
            {tracking ? "🟢 Position client en direct" : trip ? "En attente du partage du client…" : "Aucune course"}
          </p>
        </div>
        {tracking && <Badge className="bg-success/10 text-success border-success/30 gap-1"><RadioTower className="h-3 w-3" /> LIVE</Badge>}
      </header>

      <div className="flex-1 relative min-h-0">
        {markers.length > 0 ? (
          <LiveMap
            markers={markers}
            showRoute
            routePath={osrmRoute?.geometry}
            followMarkerId={tracking ? "client" : undefined}
            height="100%"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground p-6 text-center">
            <div>
              <MapPin className="mx-auto h-12 w-12 opacity-30" />
              <p className="mt-2">Aucune course assignée pour le moment.</p>
              <p className="text-xs mt-1">L'admin doit vous assigner une réservation.</p>
            </div>
          </div>
        )}

        {trip && (
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border bg-card/95 backdrop-blur shadow-lg">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Navigation className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Client : {clientName || "..."} {tracking && <span className="text-success font-medium">• 🟢 LIVE</span>}
                  </p>
                  <p className="font-semibold truncate">{trip.origin_address}</p>
                  <p className="text-sm text-muted-foreground truncate">↓ {trip.destination_address}</p>
                </div>
                {osrmRoute && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">ETA</p>
                    <p className="text-lg font-bold">
                      {routeLoading ? "…" : `${osrmRoute.durationMin} min`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {osrmRoute.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                {trip.status === "pending" && (
                  <Button onClick={() => startTrip(trip)} disabled={actionLoading} className="flex-1 gap-2">
                    <Play className="h-4 w-4" /> Démarrer la course
                  </Button>
                )}
                {trip.status === "active" && (
                  <Button onClick={() => completeTrip(trip)} disabled={actionLoading} className="flex-1 gap-2">
                    <CheckCircle className="h-4 w-4" /> Terminer la course
                  </Button>
                )}
                {clientPos && (
                  <Button variant="outline" size="icon" asChild title="Naviguer vers le client (Google Maps)">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${clientPos.latitude},${clientPos.longitude}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {!clientPos && trip.destination_lat && trip.destination_lng && (
                  <Button variant="outline" size="icon" asChild title="Ouvrir destination">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${trip.destination_lat},${trip.destination_lng}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Flag className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {trips.length > 1 && (
        <div className="border-t bg-card p-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Autres courses ({trips.length - (activeTrip ? 1 : 0)})</p>
          <div className="space-y-2">
            {trips
              .filter((t) => t.id !== activeTrip?.id)
              .map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex items-center gap-2 p-2">
                    <Radio className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.origin_address} → {t.destination_address}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
