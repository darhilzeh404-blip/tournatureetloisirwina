import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, Crosshair, Loader2, LocateFixed, LogOut, MapPin, Navigation, RefreshCw, Route as RouteIcon, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MapMarker } from "@/components/LiveMap";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useClientPosition, type ClientPosition } from "@/hooks/use-client-position";

export const Route = createFileRoute("/chauffeur")({
  head: () => ({
    meta: [
      { title: "Chauffeur — Trips actifs" },
      { name: "description", content: "Interface chauffeur mobile pour accepter les trips et ouvrir le GPS." },
    ],
  }),
  component: ChauffeurPage,
});

type TripStatus = "pending" | "assigned" | "active" | string;

interface Trip {
  id: string;
  reservation_id: string;
  client_id: string;
  driver_id: string | null;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  status: TripStatus;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  phone?: string | null;
}

interface DriverFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
}

const activeStatuses = ["pending", "assigned", "active"];
const LiveMap = lazy(() => import("@/components/LiveMap").then((module) => ({ default: module.LiveMap })));

function ChauffeurPage() {
  const { isAuthenticated, isLoading, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [clients, setClients] = useState<Record<string, Profile>>({});
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [gpsTrip, setGpsTrip] = useState<Trip | null>(null);
  const [driverFix, setDriverFix] = useState<DriverFix | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!hadDark) root.classList.remove("dark");
    };
  }, []);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isAuthenticated, isLoading, navigate, role]);

  const notify = useCallback((title: string, body: string) => {
    toast(title, { description: body });
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }, []);

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notifications non supportées sur ce navigateur.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") toast.success("Notifications activées.");
    else toast.error("Notifications refusées.");
  };

  const loadTrips = useCallback(async (silent = false, background = false) => {
    if (!user) return;
    if (background) {
      // no visible loader for automatic refresh
    } else if (silent) {
      setRefreshing(true);
    } else {
      setLoadingTrips(true);
    }

    const { data, error } = await supabase
      .from("trips")
      .select("id, reservation_id, client_id, driver_id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, status, created_at")
      .eq("driver_id", user.id)
      .in("status", activeStatuses)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Impossible de charger les trips.");
      console.error("[chauffeur] load trips", error);
      setTrips([]);
    } else {
      const list = (data as Trip[]) ?? [];
      setTrips(list);
      if (gpsTrip && !list.some((trip) => trip.id === gpsTrip.id)) setGpsTrip(null);

      const clientIds = Array.from(new Set(list.map((trip) => trip.client_id)));
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", clientIds);
        const next: Record<string, Profile> = {};
        ((profiles as Profile[]) ?? []).forEach((profile) => {
          next[profile.user_id] = profile;
        });
        setClients(next);
      } else {
        setClients({});
      }
    }

    setLastRefreshAt(new Date());
    setLoadingTrips(false);
    if (!background) setRefreshing(false);
  }, [gpsTrip, user]);

  useEffect(() => {
    if (!user) return;
    loadTrips();

    const channel = supabase
      .channel(`chauffeur-mobile-trips-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `driver_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") notify("Nouveau trip", "Une course vient de vous être assignée.");
          loadTrips(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTrips, notify, user]);

  const getDriverPosition = useCallback((options?: { silent?: boolean; loading?: boolean }) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (!options?.silent) toast.error("GPS non supporté par ce navigateur.");
      return Promise.reject(new Error("unsupported"));
    }

    if (options?.loading !== false) setGpsLoading(true);
    return new Promise<DriverFix>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const fix: DriverFix = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          };
          setDriverFix(fix);
          if (options?.loading !== false) setGpsLoading(false);
          resolve(fix);
        },
        (error) => {
          if (options?.loading !== false) setGpsLoading(false);
          const message = error.code === error.PERMISSION_DENIED
            ? "Autorisez la localisation pour utiliser Voir GPS."
            : "Position GPS indisponible. Vérifiez le signal et le HTTPS.";
          if (!options?.silent) toast.error(message);
          reject(error);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
      );
    });
  }, []);

  const saveDriverPosition = async (trip: Trip, fix: DriverFix) => {
    if (!user) return;
    const { error } = await supabase.from("driver_positions").upsert(
      {
        driver_id: user.id,
        trip_id: trip.id,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        heading: fix.heading,
        speed: fix.speed,
        archived_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" }
    );
    if (error) console.error("[chauffeur] save gps", error);
  };

  const acceptTrip = async (trip: Trip) => {
    setBusyTripId(trip.id);
    try {
      const fix = await getDriverPosition().catch(() => null);
      const { error } = await supabase
        .from("trips")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", trip.id);
      if (error) throw error;
      if (fix) await saveDriverPosition(trip, fix);
      notify("Trip accepté", "La course est maintenant en cours.");
      await loadTrips(true);
    } catch (error) {
      console.error("[chauffeur] accept", error);
      toast.error("Impossible d'accepter ce trip.");
    } finally {
      setBusyTripId(null);
    }
  };

  const refuseTrip = async (trip: Trip) => {
    setBusyTripId(trip.id);
    const snapshot = trips;
    setTrips((current) => current.filter((item) => item.id !== trip.id));
    const { error } = await supabase
      .from("trips")
      .update({ status: "cancelled" })
      .eq("id", trip.id);
    setBusyTripId(null);

    if (error) {
      setTrips(snapshot);
      toast.error("Impossible de refuser ce trip.");
      console.error("[chauffeur] refuse", error);
    } else {
      notify("Trip refusé", "La course a été retirée de votre liste.");
    }
  };

  const openGps = async (trip: Trip) => {
    setGpsTrip(trip);
    const fix = await getDriverPosition().catch(() => null);
    if (fix) await saveDriverPosition(trip, fix);
  };

  const startTrip = async (trip: Trip) => {
    setBusyTripId(trip.id);
    try {
      const fix = await getDriverPosition().catch(() => null);
      const { error } = await supabase
        .from("trips")
        .update({ status: "active", started_at: new Date().toISOString(), archived_at: null })
        .eq("id", trip.id);
      if (error) throw error;
      if (fix) await saveDriverPosition(trip, fix);
      setGpsTrip((current) => current?.id === trip.id ? { ...current, status: "active" } : current);
      notify("Course commencée", "Le client peut suivre votre position en direct.");
      await loadTrips(true);
    } catch (error) {
      console.error("[chauffeur] start", error);
      toast.error("Impossible de commencer cette course.");
    } finally {
      setBusyTripId(null);
    }
  };

  const completeTrip = async (trip: Trip) => {
    if (!user) return;
    setBusyTripId(trip.id);
    try {
      const { error } = await supabase.rpc("archive_trip_and_reservation", { _trip_id: trip.id });
      if (error) throw error;
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      setGpsTrip(null);
      notify("Course terminée", "Elle est retirée du suivi client et du GPS admin.");
    } catch (error) {
      console.error("[chauffeur] complete", error);
      toast.error("Impossible de terminer cette course.");
    } finally {
      setBusyTripId(null);
    }
  };

  const refreshNow = useCallback(async (silent = false) => {
    await loadTrips(true, silent);
    if (!gpsTrip) return;
    const fix = await getDriverPosition({ silent, loading: !silent }).catch(() => null);
    if (fix) await saveDriverPosition(gpsTrip, fix);
  }, [getDriverPosition, gpsTrip, loadTrips]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      refreshNow(true);
    }, 25_000);
    return () => window.clearInterval(interval);
  }, [refreshNow, user]);

  const activeCount = trips.filter((trip) => trip.status === "active").length;
  const assignedCount = trips.length - activeCount;
  const lastRefreshLabel = lastRefreshAt
    ? lastRefreshAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  if (isLoading) {
    return <div className="driver-app flex min-h-screen items-center justify-center bg-background text-foreground">Chargement…</div>;
  }
  if (!isAuthenticated || (role !== "chauffeur" && role !== "admin")) return null;

  return (
    <main className="driver-app min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-4">
        <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 pb-4 pt-2 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Mode chauffeur</p>
              <h1 className="text-2xl font-extrabold tracking-normal">Trips actifs</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="secondary" onClick={() => refreshNow(false)} disabled={refreshing} aria-label="Rafraîchir">
                <RefreshCw className={refreshing ? "animate-spin" : ""} />
              </Button>
              <Button size="icon" variant="secondary" onClick={enableNotifications} aria-label="Activer les notifications">
                <Bell />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }} aria-label="Déconnexion">
                <LogOut />
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="text-2xl font-bold">{assignedCount}</p>
              <p className="text-xs text-muted-foreground">Assignés</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            <span>Auto-refresh 25s · Dernier {lastRefreshLabel}</span>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => refreshNow(false)} disabled={refreshing}>
              {refreshing ? "Mise à jour…" : "Rafraîchir"}
            </Button>
          </div>
        </header>

        <section className="flex-1 space-y-3 py-4">
          {loadingTrips ? (
            <div className="flex min-h-64 items-center justify-center rounded-3xl border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : trips.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
              <RouteIcon className="h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-bold">Aucun trip actif</h2>
              <p className="mt-1 text-sm text-muted-foreground">Les nouvelles assignations apparaîtront automatiquement ici.</p>
            </div>
          ) : (
            trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                client={clients[trip.client_id]}
                busy={busyTripId === trip.id}
                onAccept={() => acceptTrip(trip)}
                onRefuse={() => refuseTrip(trip)}
                onGps={() => openGps(trip)}
              />
            ))
          )}
        </section>
      </div>

      {gpsTrip && (
        <GpsPanel
          trip={gpsTrip}
          client={clients[gpsTrip.client_id]}
          driverFix={driverFix}
          gpsLoading={gpsLoading}
          onClose={() => setGpsTrip(null)}
          onLocate={async () => {
            const fix = await getDriverPosition().catch(() => null);
            if (fix) await saveDriverPosition(gpsTrip, fix);
          }}
          onStart={() => startTrip(gpsTrip)}
          onComplete={() => completeTrip(gpsTrip)}
          busy={busyTripId === gpsTrip.id}
        />
      )}
    </main>
  );
}

function TripCard({ trip, client, busy, onAccept, onRefuse, onGps }: {
  trip: Trip;
  client?: Profile;
  busy: boolean;
  onAccept: () => void;
  onRefuse: () => void;
  onGps: () => void;
}) {
  const status = trip.status === "active" ? "En cours" : "Assigné";
  const clientName = client?.full_name || "Client";

  return (
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant={trip.status === "active" ? "default" : "secondary"}>{status}</Badge>
          <h2 className="mt-3 truncate text-lg font-bold">{clientName}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{trip.origin_address || "Position de départ"}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-secondary p-3">
          <Navigation className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background p-3">
        <p className="text-xs text-muted-foreground">Destination</p>
        <p className="truncate text-sm font-semibold">{trip.destination_address || "Non renseignée"}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={onGps} className="col-span-2 h-12 gap-2 rounded-2xl">
          <LocateFixed className="h-4 w-4" /> Voir GPS
        </Button>
        {trip.status !== "active" && (
          <Button onClick={onAccept} disabled={busy} variant="secondary" className="h-11 gap-2 rounded-2xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Accepter
          </Button>
        )}
        {trip.status !== "active" && (
          <Button onClick={onRefuse} disabled={busy} variant="outline" className="h-11 gap-2 rounded-2xl">
            <X className="h-4 w-4" /> Refuser
          </Button>
        )}
      </div>
    </article>
  );
}

function GpsPanel({ trip, client, driverFix, gpsLoading, onClose, onLocate, onStart, onComplete, busy }: {
  trip: Trip;
  client?: Profile;
  driverFix: DriverFix | null;
  gpsLoading: boolean;
  onClose: () => void;
  onLocate: () => void;
  onStart: () => void;
  onComplete: () => void;
  busy: boolean;
}) {
  const { position: clientPosition } = useClientPosition(trip.client_id);
  const markers = useMemo(() => buildMarkers(trip, driverFix, clientPosition, client?.full_name ?? undefined), [client?.full_name, clientPosition, driverFix, trip]);
  const center = driverFix
    ? [driverFix.latitude, driverFix.longitude] as [number, number]
    : markers[0]
      ? [markers[0].lat, markers[0].lng] as [number, number]
      : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">GPS trip</p>
            <h2 className="truncate text-lg font-bold">{client?.full_name || "Client"}</h2>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" onClick={onLocate} disabled={gpsLoading} aria-label="Actualiser ma position GPS">
              {gpsLoading ? <Loader2 className="animate-spin" /> : <Crosshair />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fermer la carte">
              <X />
            </Button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          {markers.length > 0 ? (
            <MapErrorBoundary>
              <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                <LiveMap markers={markers} center={center} zoom={14} showRoute height="100%" followMarkerId={driverFix ? "driver" : undefined} />
              </Suspense>
            </MapErrorBoundary>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
              <div>
                <ShieldAlert className="mx-auto h-10 w-10" />
                <p className="mt-3 text-sm">Autorisez le GPS pour afficher votre position.</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-4">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Button onClick={onStart} disabled={busy || trip.status === "active"} variant="secondary" className="h-12 rounded-2xl gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Commencer
            </Button>
            <Button onClick={onComplete} disabled={busy} className="h-12 rounded-2xl gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Terminer
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Trajet</p>
            <p className="truncate text-sm font-semibold">{trip.origin_address || "Départ"}</p>
            <p className="truncate text-sm text-muted-foreground">→ {trip.destination_address || "Destination"}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Chauffeur : {driverFix ? "GPS actif" : "Non localisé"}</span>
            <span>Client : {clientPosition ? "Visible" : "Position estimée"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMarkers(trip: Trip, driverFix: DriverFix | null, clientPosition: ClientPosition | null, clientName?: string): MapMarker[] {
  const markers: MapMarker[] = [];
  if (driverFix) {
    markers.push({ id: "driver", type: "driver", lat: driverFix.latitude, lng: driverFix.longitude, label: "Vous" });
  }
  if (clientPosition) {
    markers.push({ id: "client", type: "client", lat: Number(clientPosition.latitude), lng: Number(clientPosition.longitude), label: clientName || "Client" });
  } else if (trip.origin_lat && trip.origin_lng) {
    markers.push({ id: "client", type: "client", lat: Number(trip.origin_lat), lng: Number(trip.origin_lng), label: trip.origin_address || "Départ client" });
  }
  if (trip.destination_lat && trip.destination_lng) {
    markers.push({ id: "destination", type: "destination", lat: Number(trip.destination_lat), lng: Number(trip.destination_lng), label: trip.destination_address || "Destination" });
  }
  return markers;
}
