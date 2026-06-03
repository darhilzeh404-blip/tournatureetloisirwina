import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useClientPosition } from "@/hooks/use-client-position";
import { useGeolocation } from "@/hooks/use-geolocation";
import { LiveMap, type MapMarker } from "@/components/LiveMap";
import { useOsrmRoute } from "@/hooks/use-osrm-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, ArrowLeft, MapPin, Navigation, Play, Flag, CheckCircle, Radio, RadioTower, AlertTriangle, Loader2, MapPinOff, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";

export const Route = createFileRoute("/chauffeur/trips")({
  head: () => ({ meta: [{ title: "Mes courses — Chauffeur" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tripId: typeof search.tripId === "string" ? search.tripId : undefined,
  }),
  component: DriverTripsPage,
});

interface Trip {
  id: string;
  client_id: string;
  driver_id: string | null;
  reservation_id: string | null;
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
  const { tripId: searchTripId } = Route.useSearch();
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
  const { position: clientPos, loading: clientPosLoading, fetched: clientPosFetched } = useClientPosition(trip?.client_id ?? null);

  // Détecte un partage GPS client absent au bout de 15s (probable refus côté client)
  const [waitingTimeout, setWaitingTimeout] = useState(false);
  useEffect(() => {
    setWaitingTimeout(false);
    if (!trip || clientPos) return;
    const t = setTimeout(() => setWaitingTimeout(true), 15000);
    return () => clearTimeout(t);
  }, [trip?.id, clientPos]);

  const loadTrips = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("trips")
      .select("*, reservations!inner(service_type)")
      .eq("driver_id", user.id)
      .in("status", ["pending", "assigned", "active"])
      .in("reservations.service_type", ["VTC", "TRANSPORT_SCOLAIRE", "LOCATION_BUS"])
      .order("created_at", { ascending: false });
    const list = (data as Trip[]) || [];
    setTrips(list);
    const focused = searchTripId ? list.find((t) => t.id === searchTripId) : null;
    const active = focused ?? list.find((t) => t.status === "active") ?? list[0] ?? null;
    setActiveTrip(active);
    if (active) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", active.client_id)
        .maybeSingle();
      if (profile) setClientName(profile.full_name);
    }
  }, [user, searchTripId]);

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
    if (error) {
      console.error("startTrip error", error);
      toast.error("Impossible de démarrer la course.");
    } else {
      toast.success("Course démarrée. Suivi du client activé.");
      await loadTrips();
    }
  };

  const completeTrip = async (t: Trip) => {
    setActionLoading(true);
    const { error } = await supabase.rpc("archive_trip_and_reservation", { _trip_id: t.id });
    setActionLoading(false);
    if (error) {
      console.error("completeTrip error", error);
      toast.error("Erreur lors de la finalisation.");
    } else {
      toast.success("Course terminée.");
      setActiveTrip(null);
      setTrips((prev) => prev.filter((x) => x.id !== t.id));
      await loadTrips();
    }
  };

  // Position GPS du chauffeur (local) pour tracer le segment chauffeur → client
  const { position: driverGeo } = useGeolocation({ enabled: Boolean(trip) });
  const driverPoint = driverGeo
    ? { lat: Number(driverGeo.latitude), lng: Number(driverGeo.longitude) }
    : null;

  // Markers : position du chauffeur, position du client (live ou origin prévu), destination
  const markers: MapMarker[] = [];
  if (trip) {
    if (driverPoint)
      markers.push({ id: "me", lat: driverPoint.lat, lng: driverPoint.lng, type: "driver", label: "Vous", service: "vtc" });
    if (trip.destination_lat && trip.destination_lng)
      markers.push({ id: "dest", lat: Number(trip.destination_lat), lng: Number(trip.destination_lng), type: "destination", label: trip.destination_address });
    if (clientPos) {
      markers.push({ id: "client", lat: Number(clientPos.latitude), lng: Number(clientPos.longitude), type: "client", label: clientName || "Client (live)" });
    } else if (trip.origin_lat && trip.origin_lng) {
      markers.push({ id: "origin", lat: Number(trip.origin_lat), lng: Number(trip.origin_lng), type: "client", label: trip.origin_address });
    }
  }

  // Itinéraires OSRM : (1) chauffeur → client (prise en charge), (2) client → destination finale
  const clientPoint = clientPos
    ? { lat: Number(clientPos.latitude), lng: Number(clientPos.longitude) }
    : trip?.origin_lat && trip?.origin_lng
    ? { lat: Number(trip.origin_lat), lng: Number(trip.origin_lng) }
    : null;
  const toPoint = trip?.destination_lat && trip?.destination_lng
    ? { lat: Number(trip.destination_lat), lng: Number(trip.destination_lng) }
    : null;

  const refreshKey = `${driverPoint ? `${driverPoint.lat.toFixed(3)}-${driverPoint.lng.toFixed(3)}` : "nd"}|${clientPos ? `${Number(clientPos.latitude).toFixed(3)}-${Number(clientPos.longitude).toFixed(3)}` : "nc"}`;

  const isActive = trip?.status === "active";
  const { route: pickupRoute, loading: pickupLoading } = useOsrmRoute(
    driverPoint,
    clientPoint,
    Boolean(driverPoint && clientPoint && !isActive),
    refreshKey,
  );
  const { route: dropoffRoute, loading: dropoffLoading } = useOsrmRoute(
    isActive && driverPoint ? driverPoint : clientPoint,
    toPoint,
    Boolean((isActive && driverPoint ? driverPoint : clientPoint) && toPoint),
    refreshKey,
  );
  const combinedGeometry: [number, number][] | undefined =
    pickupRoute?.geometry && dropoffRoute?.geometry
      ? [...pickupRoute.geometry, ...dropoffRoute.geometry]
      : pickupRoute?.geometry ?? dropoffRoute?.geometry;
  const routeLoading = pickupLoading || dropoffLoading;
  const osrmRoute = dropoffRoute ?? pickupRoute;

  const tracking = !!clientPos;

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Chargement...</div>;
  if (!user) return null;

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
          <MapErrorBoundary>
            <LiveMap
              markers={markers}
              showRoute
              routePath={osrmRoute?.geometry}
              followMarkerId={tracking ? "client" : undefined}
              height="100%"
            />
          </MapErrorBoundary>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground p-6 text-center">
            <div>
              <MapPin className="mx-auto h-12 w-12 opacity-30" />
              <p className="mt-2">Aucune course assignée pour le moment.</p>
              <p className="text-xs mt-1">L'admin doit vous assigner une réservation.</p>
            </div>
          </div>
        )}

        {trip && clientPosLoading && !clientPos && (
          <div className="absolute top-4 left-4 right-4 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-md flex items-center gap-3 text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Recherche de la position du client…</p>
              <p className="text-xs text-muted-foreground mt-0.5">Connexion au flux GPS en temps réel.</p>
            </div>
          </div>
        )}

        {trip && !clientPosLoading && clientPosFetched && !clientPos && !waitingTimeout && (
          <div className="absolute top-4 left-4 right-4 rounded-xl border border-muted bg-card/95 backdrop-blur p-3 shadow-md flex items-start gap-2 text-sm">
            <MapPinOff className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Aucune position disponible</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Le client n'a pas encore partagé de coordonnées GPS. En attente du premier signal…
              </p>
            </div>
          </div>
        )}

        {trip && !tracking && waitingTimeout && (
          <div className="absolute top-4 left-4 right-4 rounded-xl border border-warning/30 bg-warning/10 p-3 shadow-md flex items-start gap-2 text-sm">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Position client indisponible</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Le client n'a pas encore partagé sa position GPS (autorisation refusée, hors ligne ou app fermée). Contactez-le pour qu'il ouvre « Mes réservations » et autorise la localisation.
              </p>
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
                      Arrivée ~{new Date(Date.now() + osrmRoute.durationMin * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {osrmRoute.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                {(trip.status === "pending" || trip.status === "assigned") && (
                  <Button onClick={() => startTrip(trip)} disabled={actionLoading} className="flex-1 gap-2">
                    <Play className="h-4 w-4" /> Démarrer la course
                  </Button>
                )}
                {trip.status === "active" && (
                  <Button onClick={() => completeTrip(trip)} disabled={actionLoading} className="flex-1 gap-2">
                    <CheckCircle className="h-4 w-4" /> Terminer la course
                  </Button>
                )}
              </div>

              {/* Navigation GPS selon le statut */}
              {trip.status === "pending" || trip.status === "assigned" ? (
                trip.origin_lat && trip.origin_lng ? (
                  <Button asChild variant="secondary" className="mt-2 w-full gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${trip.origin_lat},${trip.origin_lng}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="h-4 w-4" />
                      Naviguer vers le pickup
                    </a>
                  </Button>
                ) : null
              ) : trip.status === "active" ? (
                clientPos ? (
                  <Button asChild variant="secondary" className="mt-2 w-full gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${clientPos.latitude},${clientPos.longitude}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="h-4 w-4" />
                      Naviguer vers le client
                    </a>
                  </Button>
                ) : trip.destination_lat && trip.destination_lng ? (
                  <Button asChild variant="secondary" className="mt-2 w-full gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${trip.destination_lat},${trip.destination_lng}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Flag className="h-4 w-4" />
                      Naviguer vers la destination
                    </a>
                  </Button>
                ) : null
              ) : null}

              {/* Itinéraire complet : pickup → destination (toujours visible si coordonnées dispo) */}
              {trip.origin_lat && trip.origin_lng && trip.destination_lat && trip.destination_lng && (
                <Button asChild variant="outline" className="mt-2 w-full gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${trip.origin_lat},${trip.origin_lng}&destination=${trip.destination_lat},${trip.destination_lng}&travelmode=driving`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <RouteIcon className="h-4 w-4" />
                    Itinéraire complet (pickup → destination)
                  </a>
                </Button>
              )}
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
