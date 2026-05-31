import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle, Clock, Crosshair, Hand, History, LayoutDashboard, Loader2, LogOut,
  MapPin, Navigation, Play, RefreshCw, Route as RouteIcon, TrendingUp, Wallet, Zap,
} from "lucide-react";
import { useOsrmRoute } from "@/hooks/use-osrm-route";
import type { MapMarker } from "@/components/LiveMap";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { showAppNotification, requestNotificationPermission } from "@/lib/notifications";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}


export const Route = createFileRoute("/chauffeur-vtc")({
  head: () => ({
    meta: [
      { title: "Chauffeur VTC — Agence Wina" },
      { name: "description", content: "Interface chauffeur VTC : tableau de bord, courses et historique." },
    ],
  }),
  component: ChauffeurVtcPage,
});

const LiveMap = lazy(() => import("@/components/LiveMap").then((m) => ({ default: m.LiveMap })));

const COMMISSION_RATE = 0.2;
const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

interface VtcTrip {
  id: string;
  client_id: string;
  driver_id: string | null;
  reservation_id: string;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  reservations: { service_type: string; total_amount: number; reservation_date: string } | null;
}

type Tab = "dashboard" | "pool" | "courses" | "historique";

function ChauffeurVtcPage() {
  const { isAuthenticated, isLoading, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pool, setPool] = useState<VtcTrip[]>([]);
  const [active, setActive] = useState<VtcTrip[]>([]);
  const [completed, setCompleted] = useState<VtcTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Load current online status
  useEffect(() => {
    if (!user) return;
    supabase
      .from("driver_availability")
      .select("is_online")
      .eq("driver_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsOnline(Boolean(data?.is_online)));
  }, [user]);

  const setOnline = useCallback(async (next: boolean) => {
    if (!user) return;
    setTogglingOnline(true);
    const { error } = await supabase.from("driver_availability").upsert({
      driver_id: user.id,
      is_online: next,
      last_seen_at: new Date().toISOString(),
    });
    setTogglingOnline(false);
    if (error) { toast.error("Impossible de changer le statut"); return; }
    setIsOnline(next);
    if (next) {
      void requestNotificationPermission();
    } else {
      // Archive current position so we disappear from the map / dispatch radius
      void supabase
        .from("driver_positions")
        .update({ archived_at: new Date().toISOString() })
        .eq("driver_id", user.id)
        .is("archived_at", null);
    }
    toast.success(next ? "Vous êtes en ligne" : "Vous êtes hors ligne");

  }, [user]);


  // Heartbeat: refresh last_seen_at every 30s while online; mark offline on tab close
  useEffect(() => {
    if (!user || !isOnline) return;
    const ping = () => {
      supabase.from("driver_availability").update({
        last_seen_at: new Date().toISOString(),
      }).eq("driver_id", user.id).then(() => {});
    };
    ping();
    const id = window.setInterval(ping, 30_000);
    const handleHide = () => {
      if (document.visibilityState === "hidden") {
        navigator.sendBeacon?.("");
      }
    };
    document.addEventListener("visibilitychange", handleHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", handleHide);
    };
  }, [user, isOnline]);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isAuthenticated, isLoading, role, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Pool: pending VTC trips, unassigned (only fetched when online)
    let poolData: unknown[] = [];
    if (isOnline) {
      const { data, error: e0 } = await supabase
        .from("trips")
        .select("*, reservations!inner(service_type, total_amount, reservation_date)")
        .is("driver_id", null)
        .eq("status", "pending")
        .eq("reservations.service_type", "VTC")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (e0) console.error("[vtc] pool", e0);
      poolData = data ?? [];
    }

    // Active VTC trips assigned to me
    const { data: act, error: e1 } = await supabase
      .from("trips")
      .select("*, reservations!inner(service_type, total_amount, reservation_date)")
      .eq("driver_id", user.id)
      .eq("reservations.service_type", "VTC")
      .in("status", ["assigned", "active"])
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    // Completed VTC trips (history)
    const { data: done, error: e2 } = await supabase
      .from("trips")
      .select("*, reservations!inner(service_type, total_amount, reservation_date)")
      .eq("driver_id", user.id)
      .eq("reservations.service_type", "VTC")
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(100);

    if (e1) console.error("[vtc] active", e1);
    if (e2) console.error("[vtc] history", e2);
    setPool((poolData as unknown as VtcTrip[]) ?? []);
    setActive((act as unknown as VtcTrip[]) ?? []);
    setCompleted((done as unknown as VtcTrip[]) ?? []);
    setLoading(false);
  }, [user, isOnline]);

  useEffect(() => {
    if (!user) return;
    load();
    // Listen to ALL trip changes (RLS filters; pool + own trips visible).
    const ch = supabase
      .channel(`chauffeur-vtc-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trips" },
        (payload) => {
          const t = payload.new as { status?: string; driver_id?: string | null; origin_lat?: number | null; origin_lng?: number | null };
          if (isOnline && t?.status === "pending" && !t.driver_id) {
            // Optional 5km proximity filter for notification
            let withinRange = true;
            if (driverPos && t.origin_lat != null && t.origin_lng != null) {
              const km = haversineKm(driverPos.lat, driverPos.lng, Number(t.origin_lat), Number(t.origin_lng));
              withinRange = km <= 5;
            }
            if (withinRange) {
              showAppNotification("Nouvelle course VTC à proximité", {
                body: "Une demande vient d'arriver. Acceptez avant les autres !",
                tag: "vtc-pool",
              });
            }
          }
          load();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips" },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load, isOnline, driverPos]);


  // Live driver position for the dashboard map + realtime upsert to driver_positions
  // (used by clients to see the car and by the 5 km dispatch filter).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let lastPushAt = 0;
    let lastLat: number | null = null;
    let lastLng: number | null = null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        setDriverPos({ lat, lng });
        if (!user || !isOnline) return;
        // Throttle: push at most every 5 s OR when the driver has moved >= 20 m.
        const now = Date.now();
        const movedFar =
          lastLat == null || lastLng == null
            ? true
            : haversineKm(lastLat, lastLng, lat, lng) * 1000 >= 20;
        if (now - lastPushAt < 5000 && !movedFar) return;
        lastPushAt = now;
        lastLat = lat;
        lastLng = lng;
        void supabase.from("driver_positions").upsert(
          {
            driver_id: user.id,
            latitude: lat,
            longitude: lng,
            heading: p.coords.heading ?? null,
            speed: p.coords.speed ?? null,
            accuracy: p.coords.accuracy ?? null,
            archived_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "driver_id" },
        );
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [user, isOnline]);

  // Only show pool trips within 5 km of the driver's current position.
  // If GPS is not yet available, show everything so we don't hide work.
  const nearbyPool = useMemo(() => {
    if (!driverPos) return pool;
    return pool
      .map((t) => {
        const lat = t.origin_lat != null ? Number(t.origin_lat) : null;
        const lng = t.origin_lng != null ? Number(t.origin_lng) : null;
        const km = lat != null && lng != null
          ? haversineKm(driverPos.lat, driverPos.lng, lat, lng)
          : null;
        return { trip: t, km };
      })
      .filter(({ km }) => km == null || km <= 5)
      .sort((a, b) => (a.km ?? 99) - (b.km ?? 99))
      .map(({ trip }) => trip);
  }, [pool, driverPos]);


  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const buckets = { day: { count: 0, gross: 0 }, week: { count: 0, gross: 0 }, month: { count: 0, gross: 0 } };
    for (const t of completed) {
      const ts = t.completed_at ? new Date(t.completed_at) : null;
      if (!ts) continue;
      const amt = t.reservations?.total_amount ?? 0;
      if (ts >= startOfDay) { buckets.day.count++; buckets.day.gross += amt; }
      if (ts >= startOfWeek) { buckets.week.count++; buckets.week.gross += amt; }
      if (ts >= startOfMonth) { buckets.month.count++; buckets.month.gross += amt; }
    }
    return buckets;
  }, [completed]);

  const acceptTrip = async (t: VtcTrip) => {
    setBusyId(t.id);
    const { error } = await supabase.rpc("accept_vtc_trip", { _trip_id: t.id });
    setBusyId(null);
    if (error) {
      const msg = error.message || "";
      if (msg.includes("ALREADY_TAKEN")) {
        toast.error("Course déjà prise par un autre chauffeur");
      } else {
        toast.error("Impossible d'accepter la course");
      }
      load();
      return;
    }
    toast.success("Course acceptée !");
    setTab("courses");
    load();
  };

  const startTrip = async (t: VtcTrip) => {
    setBusyId(t.id);
    const { error } = await supabase
      .from("trips")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", t.id);
    setBusyId(null);
    if (error) { toast.error("Impossible de démarrer la course"); return; }
    toast.success("Course démarrée");
    load();
  };

  const completeTrip = async (t: VtcTrip) => {
    setBusyId(t.id);
    const { error } = await supabase.rpc("archive_trip_and_reservation", { _trip_id: t.id });
    setBusyId(null);
    if (error) { toast.error("Erreur lors de la finalisation"); return; }
    toast.success("Course terminée");
    load();
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Chargement…</div>;
  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <Link to="/chauffeur"><Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Espace chauffeur</p>
            <h1 className="truncate text-lg font-extrabold">VTC indépendant</h1>
          </div>
          <Button size="icon" variant="ghost" onClick={() => load()} aria-label="Rafraîchir"><RefreshCw className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }} aria-label="Déconnexion"><LogOut className="h-4 w-4" /></Button>
        </div>
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 border-t px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5 ${isOnline ? "" : "opacity-40"}`}>
              {isOnline && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
            </span>
            <p className="text-sm font-semibold">{isOnline ? "En ligne" : "Hors ligne"}</p>
            <p className="text-[11px] text-muted-foreground">
              {isOnline ? "vous recevez les demandes" : "vous ne recevez aucune course"}
            </p>
          </div>
          <Button
            size="sm"
            variant={isOnline ? "outline" : "default"}
            disabled={togglingOnline}
            onClick={() => setOnline(!isOnline)}
          >
            {togglingOnline ? <Loader2 className="h-4 w-4 animate-spin" /> : (isOnline ? "Passer hors ligne" : "Passer en ligne")}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4">
        {tab === "dashboard" && <DashboardTab stats={stats} active={active} driverPos={driverPos} poolCount={nearbyPool.length} onGoPool={() => setTab("pool")} isOnline={isOnline} />}
        {tab === "pool" && (
          <PoolTab trips={nearbyPool} loading={loading} busyId={busyId} onAccept={acceptTrip} isOnline={isOnline} onGoOnline={() => setOnline(true)} driverPos={driverPos} />

        )}
        {tab === "courses" && (
          <CoursesTab
            trips={active}
            loading={loading}
            busyId={busyId}
            onStart={startTrip}
            onComplete={completeTrip}
          />
        )}
        {tab === "historique" && <HistoryTab trips={completed} loading={loading} />}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<LayoutDashboard className="h-5 w-5" />} label="Dashboard" />
          <TabBtn active={tab === "pool"} onClick={() => setTab("pool")} icon={<Zap className="h-5 w-5" />} label="Demandes" badge={nearbyPool.length || undefined} />
          <TabBtn active={tab === "courses"} onClick={() => setTab("courses")} icon={<RouteIcon className="h-5 w-5" />} label="Courses" badge={active.length || undefined} />
          <TabBtn active={tab === "historique"} onClick={() => setTab("historique")} icon={<History className="h-5 w-5" />} label="Historique" />
        </div>
      </nav>
    </main>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
    >
      {icon}
      <span>{label}</span>
      {badge ? (
        <span className="absolute right-6 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{badge}</span>
      ) : null}
    </button>
  );
}

function DashboardTab({ stats, active, driverPos, poolCount, onGoPool, isOnline }: {
  stats: { day: { count: number; gross: number }; week: { count: number; gross: number }; month: { count: number; gross: number } };
  active: VtcTrip[];
  driverPos: { lat: number; lng: number } | null;
  poolCount: number;
  onGoPool: () => void;
  isOnline: boolean;
}) {
  const [followMe, setFollowMe] = useState(true);
  const currentTrip = active[0] ?? null;

  const origin = currentTrip?.origin_lat && currentTrip?.origin_lng
    ? { lat: Number(currentTrip.origin_lat), lng: Number(currentTrip.origin_lng) }
    : null;
  const destination = currentTrip?.destination_lat && currentTrip?.destination_lng
    ? { lat: Number(currentTrip.destination_lat), lng: Number(currentTrip.destination_lng) }
    : null;

  // Route from driver position (if active) or from origin to destination
  const routeFrom = driverPos && currentTrip?.status === "active" ? driverPos : origin;
  const refreshKey = driverPos
    ? `${driverPos.lat.toFixed(3)}-${driverPos.lng.toFixed(3)}`
    : "static";
  const { route: osrmRoute } = useOsrmRoute(
    routeFrom,
    destination,
    Boolean(routeFrom && destination),
    refreshKey,
  );

  const markers: MapMarker[] = [];
  if (driverPos) markers.push({ id: "me", lat: driverPos.lat, lng: driverPos.lng, type: "driver", label: "Vous" });
  if (origin) markers.push({ id: "origin", lat: origin.lat, lng: origin.lng, type: "client", label: currentTrip?.origin_address || "Départ" });
  if (destination) markers.push({ id: "dest", lat: destination.lat, lng: destination.lng, type: "destination", label: currentTrip?.destination_address || "Arrivée" });

  const center: [number, number] | undefined = driverPos ? [driverPos.lat, driverPos.lng] : undefined;

  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-bold text-amber-700 dark:text-amber-400">Vous êtes hors ligne</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Activez "En ligne" en haut pour recevoir des demandes VTC.</p>
        </div>
      )}
      {isOnline && poolCount > 0 && (
        <button
          onClick={onGoPool}
          className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{poolCount} demande{poolCount > 1 ? "s" : ""} en attente</p>
            <p className="text-xs text-muted-foreground">Toucher pour accepter une course</p>
          </div>
          <Hand className="h-5 w-5 text-primary" />
        </button>
      )}
      <Card className="overflow-hidden">
        <div className="relative h-64 w-full">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carte…</div>}>
            <MapErrorBoundary>
              {markers.length > 0 ? (
                <LiveMap
                  markers={markers}
                  height="100%"
                  zoom={14}
                  center={center}
                  showRoute={Boolean(currentTrip)}
                  routePath={osrmRoute?.geometry}
                  followMarkerId={followMe && driverPos ? "me" : undefined}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  <MapPin className="mr-2 h-4 w-4" /> Position GPS en attente…
                </div>
              )}
            </MapErrorBoundary>
          </Suspense>
          {driverPos && (
            <Button
              size="sm"
              variant={followMe ? "default" : "secondary"}
              onClick={() => setFollowMe((v) => !v)}
              className="absolute bottom-3 right-3 z-[400] gap-1.5 shadow-lg"
            >
              <Crosshair className="h-4 w-4" />
              {followMe ? "Suivi actif" : "Centrer sur moi"}
            </Button>
          )}
          {osrmRoute && currentTrip && (
            <div className="absolute left-3 top-3 z-[400] rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur">
              {osrmRoute.distanceKm.toFixed(1)} km · {osrmRoute.durationMin} min
            </div>
          )}
        </div>
      </Card>

      <StatBlock label="Aujourd'hui" data={stats.day} icon={<Clock className="h-4 w-4" />} />
      <StatBlock label="Cette semaine" data={stats.week} icon={<TrendingUp className="h-4 w-4" />} />
      <StatBlock label="Ce mois" data={stats.month} icon={<Wallet className="h-4 w-4" />} />

      {stats.day.count === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Pas de courses aujourd'hui
        </div>
      )}

      {currentTrip && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Course en cours</p>
            <p className="mt-1 truncate font-bold">{currentTrip.origin_address} → {currentTrip.destination_address}</p>
            <Badge className="mt-2" variant={currentTrip.status === "active" ? "default" : "secondary"}>{currentTrip.status}</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBlock({ label, data, icon }: { label: string; data: { count: number; gross: number }; icon: React.ReactNode }) {
  const net = data.gross * (1 - COMMISSION_RATE);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</p>
          <Badge variant="secondary">{data.count} course{data.count > 1 ? "s" : ""}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Brut</p>
            <p className="text-lg font-bold">{FCFA(data.gross)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Net (−20%)</p>
            <p className="text-lg font-bold text-primary">{FCFA(net)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoursesTab({ trips, loading, busyId, onStart, onComplete }: {
  trips: VtcTrip[]; loading: boolean; busyId: string | null;
  onStart: (t: VtcTrip) => void; onComplete: (t: VtcTrip) => void;
}) {
  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (trips.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
        <RouteIcon className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-bold">Aucune course VTC</h2>
        <p className="mt-1 text-sm text-muted-foreground">Les nouvelles courses assignées apparaîtront ici.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {trips.map((t) => (
        <Card key={t.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status === "active" ? "En cours" : "Assignée"}</Badge>
              <p className="text-sm font-bold text-primary">{FCFA(t.reservations?.total_amount ?? 0)}</p>
            </div>
            <p className="mt-3 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{t.origin_address}</span></p>
            <p className="mt-1 flex items-start gap-2 text-sm"><Navigation className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{t.destination_address}</span></p>

            <div className="mt-4 flex gap-2">
              <Link to="/chauffeur/trips" search={{ tripId: t.id }} className="flex-1">
                <Button variant="outline" className="w-full gap-2"><Navigation className="h-4 w-4" />Suivi</Button>
              </Link>
              {t.status !== "active" ? (
                <Button onClick={() => onStart(t)} disabled={busyId === t.id} className="flex-1 gap-2">
                  {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Démarrer
                </Button>
              ) : (
                <Button onClick={() => onComplete(t)} disabled={busyId === t.id} className="flex-1 gap-2">
                  {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Terminer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HistoryTab({ trips, loading }: { trips: VtcTrip[]; loading: boolean }) {
  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (trips.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
        <History className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-bold">Pas encore d'historique</h2>
        <p className="mt-1 text-sm text-muted-foreground">Vos courses terminées apparaîtront ici.</p>
      </div>
    );
  }

  const totalGross = trips.reduce((s, t) => s + (t.reservations?.total_amount ?? 0), 0);
  const totalNet = totalGross * (1 - COMMISSION_RATE);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Total brut</p>
            <p className="text-lg font-bold">{FCFA(totalGross)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Total net</p>
            <p className="text-lg font-bold text-primary">{FCFA(totalNet)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Brut</th>
              <th className="px-3 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => {
              const gross = t.reservations?.total_amount ?? 0;
              const net = gross * (1 - COMMISSION_RATE);
              const date = t.completed_at ? new Date(t.completed_at) : null;
              return (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{date?.toLocaleDateString("fr-FR") ?? "—"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{t.origin_address} → {t.destination_address}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{FCFA(gross)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">{FCFA(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PoolCountdown({ createdAt, windowSec = 120 }: { createdAt: string; windowSec?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const remaining = Math.max(0, windowSec - elapsed);
  const m = Math.floor(remaining / 60);
  const s = String(remaining % 60).padStart(2, "0");
  const danger = remaining <= 20;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
      <Clock className="h-3 w-3" /> Disponible {m}:{s}
    </span>
  );
}

function PoolTab({ trips, loading, busyId, onAccept, isOnline, onGoOnline, driverPos }: {
  trips: VtcTrip[]; loading: boolean; busyId: string | null;
  onAccept: (t: VtcTrip) => void;
  isOnline: boolean;
  onGoOnline: () => void;
  driverPos: { lat: number; lng: number } | null;
}) {
  if (!isOnline) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
        <Zap className="h-12 w-12 text-amber-500" />
        <h2 className="mt-4 text-lg font-bold">Vous êtes hors ligne</h2>
        <p className="mt-1 text-sm text-muted-foreground">Passez en ligne pour voir les demandes VTC en temps réel.</p>
        <Button onClick={onGoOnline} className="mt-4">Passer en ligne</Button>
      </div>
    );
  }
  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (trips.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <Zap className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-bold">Aucune demande pour l'instant</h2>
        <p className="mt-1 text-sm text-muted-foreground">Vous serez notifié dès qu'un client commande un VTC.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-primary/5 p-3 text-center text-xs text-muted-foreground">
        ⚡ {trips.length} demande{trips.length > 1 ? "s" : ""} disponible{trips.length > 1 ? "s" : ""} — premier arrivé, premier servi
      </div>
      {trips.map((t) => {
        const km =
          driverPos && t.origin_lat != null && t.origin_lng != null
            ? haversineKm(driverPos.lat, driverPos.lng, Number(t.origin_lat), Number(t.origin_lng))
            : null;
        return (
          <Card key={t.id} className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">Nouvelle demande</Badge>
                  {km != null && (
                    <Badge variant="secondary" className="gap-1">
                      <Navigation className="h-3 w-3" /> {km.toFixed(1)} km
                    </Badge>
                  )}
                  <PoolCountdown createdAt={t.created_at} />
                </div>
                <p className="text-sm font-bold text-primary tabular-nums">{FCFA(t.reservations?.total_amount ?? 0)}</p>
              </div>
              <div className="mt-3 space-y-2 rounded-2xl border border-border bg-background p-3">
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate"><span className="text-muted-foreground">Départ : </span>{t.origin_address}</span>
                </p>
                <p className="flex items-start gap-2 text-sm">
                  <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate"><span className="text-muted-foreground">Arrivée : </span>{t.destination_address}</span>
                </p>
              </div>
              <Button
                onClick={() => onAccept(t)}
                disabled={busyId === t.id}
                className="mt-4 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                size="lg"
              >
                {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                Accepter la course
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

