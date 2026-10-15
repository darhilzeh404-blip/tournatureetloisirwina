import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CheckCircle, Clock, Crosshair, Hand, History, LayoutDashboard, Loader2, LogOut,
  MapPin, Navigation, Play, RefreshCw, Route as RouteIcon, TrendingUp, Wallet, Zap,
  Volume2,
} from "lucide-react";
import { playHorn, sendHorn } from "@/lib/vtc-horn";
import { AlertTestButton } from "@/components/vtc/AlertTestButton";
import { useOsrmRoute } from "@/hooks/use-osrm-route";
import type { MapMarker } from "@/components/LiveMap";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useSharedClock } from "@/lib/shared-clock";
import { useAuth } from "@/hooks/use-auth";
import { showAppNotification, requestNotificationPermission } from "@/lib/notifications";
import { EtaBadge } from "@/components/EtaBadge";
import { shouldDispatchTripToDriver } from "@/lib/vtc-category-filter";

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

const COMMISSION_RATE = 0.1;
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
  reservations: { service_type: string; total_amount: number; reservation_date: string; details: Record<string, unknown> | null } | null;
}

type Tab = "dashboard" | "pool" | "courses" | "historique";

function ChauffeurVtcPage() {
  const { isAuthenticated, isLoading, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pool, setPool] = useState<VtcTrip[]>([]);
  const [active, setActive] = useState<VtcTrip[]>([]);
  const [completed, setCompleted] = useState<VtcTrip[]>([]);
  const [earnings, setEarnings] = useState<{ amount: number; validated_at: string | null; completed_at: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const [driverCategory, setDriverCategory] = useState<"STANDARD" | "CONFORT" | "VIP" | null>(null);

  const driverPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const isOnlineRef = useRef(false);
  const driverCategoryRef = useRef<"STANDARD" | "CONFORT" | "VIP" | null>(null);
  const lastActionAtRef = useRef<Record<string, number>>({});
  useEffect(() => { driverPosRef.current = driverPos; }, [driverPos]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { driverCategoryRef.current = driverCategory; }, [driverCategory]);

  // Load driver's category (used to filter incoming trip notifications)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("drivers")
      .select("category")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const c = (data as { category?: string } | null)?.category;
        if (c === "STANDARD" || c === "CONFORT" || c === "VIP") setDriverCategory(c);
      });
  }, [user]);


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

    // Going OFFLINE: just flip the flag and archive position.
    if (!next) {
      const { error } = await supabase.from("driver_availability").upsert({
        driver_id: user.id,
        is_online: false,
        last_seen_at: new Date().toISOString(),
      });
      setTogglingOnline(false);
      if (error) { toast.error("Impossible de changer le statut"); return; }
      setIsOnline(false);
      void supabase
        .from("driver_positions")
        .update({ archived_at: new Date().toISOString() })
        .eq("driver_id", user.id)
        .is("archived_at", null);
      toast.success("Vous êtes hors ligne");
      return;
    }

    // Going ONLINE: REQUIRE a fresh GPS fix BEFORE flipping the flag.
    // Without an active driver_positions row, the dispatch RPC excludes us.
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTogglingOnline(false);
      toast.error("Géolocalisation non supportée par ce navigateur.");
      return;
    }

    const fix = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      );
    });

    if (!fix) {
      setTogglingOnline(false);
      toast.error("Autorisation GPS requise pour passer en ligne. Activez la localisation dans votre navigateur.");
      return;
    }

    const lat = fix.coords.latitude;
    const lng = fix.coords.longitude;

    // 1. Upsert position FIRST so the dispatch radius includes us immediately.
    const { error: posErr } = await supabase.from("driver_positions").upsert(
      {
        driver_id: user.id,
        latitude: lat,
        longitude: lng,
        heading: fix.coords.heading ?? null,
        speed: fix.coords.speed ?? null,
        accuracy: fix.coords.accuracy ?? null,
        archived_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    if (posErr) {
      setTogglingOnline(false);
      toast.error("Impossible d'enregistrer votre position");
      return;
    }

    // 2. Then flip availability ON.
    const { error } = await supabase.from("driver_availability").upsert({
      driver_id: user.id,
      is_online: true,
      last_seen_at: new Date().toISOString(),
    });
    setTogglingOnline(false);
    if (error) { toast.error("Impossible de changer le statut"); return; }
    setIsOnline(true);
    setDriverPos({ lat, lng });
    void requestNotificationPermission();
    toast.success("Vous êtes en ligne");
  }, [user]);

  // Heartbeat: refresh last_seen_at + position every 30s while online so we
  // stay inside the dispatch window even if the driver isn't moving.
  // IMPORTANT: deps are only [user, isOnline] — we read driverPos via ref so
  // GPS updates do NOT tear this effect down.
  useEffect(() => {
    if (!user || !isOnline) return;
    const ping = () => {
      supabase.from("driver_availability").update({
        last_seen_at: new Date().toISOString(),
      }).eq("driver_id", user.id).then(() => {});
      const pos = driverPosRef.current;
      if (pos) {
        supabase.from("driver_positions").upsert(
          {
            driver_id: user.id,
            latitude: pos.lat,
            longitude: pos.lng,
            archived_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "driver_id" },
        ).then(() => {});
      }
    };
    ping();
    // Le ping GPS ne tourne plus quand l'app est en arrière-plan sur Android.
    let id: number | null = null;
    const startPing = () => { if (id === null) id = window.setInterval(ping, 30_000); };
    const stopPing = () => { if (id !== null) { window.clearInterval(id); id = null; } };
    const onVisibility = () => { if (document.hidden) stopPing(); else { ping(); startPing(); } };
    if (!document.hidden) startPing();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPing();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, isOnline]);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isAuthenticated, isLoading, role, navigate]);

  // Deep-link: ouverture depuis une notification système ?tab=pool&trip=xxx
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    const trip = params.get("trip");
    if (t === "pool") setTab("pool");
    if (!trip) return;
    // Le retry était récursif sans annulation : en quittant l'écran avant la fin
    // il continuait de tourner 5 s en arrière-plan.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryScroll = (attempts = 0) => {
      const el = document.getElementById(`vtc-trip-${trip}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (attempts < 20) timer = setTimeout(() => tryScroll(attempts + 1), 250);
    };
    timer = setTimeout(() => tryScroll(), 300);
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Pool: pending VTC trips, unassigned (only fetched when online).
    // Uses a SECURITY DEFINER RPC that returns only the minimum fields
    // needed to decide whether to accept (no full reservation row / details).
    let poolData: VtcTrip[] = [];
    if (isOnline) {
      const { data, error: e0 } = await supabase.rpc("get_vtc_pending_pool");
      if (e0) console.error("[vtc] pool", e0);
      poolData = ((data ?? []) as Array<{
        trip_id: string;
        reservation_id: string;
        created_at: string;
        origin_address: string;
        destination_address: string;
        origin_lat: number | null;
        origin_lng: number | null;
        destination_lat: number | null;
        destination_lng: number | null;
        total_amount: number;
        payment_mode: string;
        reservation_date: string;
      }>).map((r) => ({
        id: r.trip_id,
        client_id: "",
        driver_id: null,
        reservation_id: r.reservation_id,
        origin_address: r.origin_address,
        origin_lat: r.origin_lat,
        origin_lng: r.origin_lng,
        destination_address: r.destination_address,
        destination_lat: r.destination_lat,
        destination_lng: r.destination_lng,
        status: "pending",
        created_at: r.created_at,
        started_at: null,
        completed_at: null,
        archived_at: null,
        reservations: {
          service_type: "VTC",
          total_amount: r.total_amount,
          reservation_date: r.reservation_date,
          details: { payment_mode: r.payment_mode },
        },
      })) as VtcTrip[];
    }


    // Active VTC trips assigned to me (via SECURITY DEFINER RPC, no direct reservations read)
    const { data: act, error: e1 } = await supabase.rpc("get_chauffeur_vtc_active_trips");

    // Completed VTC trips (history) — also via RPC
    const { data: done, error: e2 } = await supabase.rpc("get_chauffeur_vtc_completed_trips", { _limit: 100 });

    if (e1) console.error("[vtc] active", e1);
    if (e2) console.error("[vtc] history", e2);

    const mapRpcRow = (r: Record<string, unknown>): VtcTrip => ({
      id: r.id as string,
      reservation_id: r.reservation_id as string,
      client_id: r.client_id as string,
      driver_id: (r.driver_id as string) ?? null,
      origin_address: (r.origin_address as string) ?? "",
      origin_lat: (r.origin_lat as number) ?? null,
      origin_lng: (r.origin_lng as number) ?? null,
      destination_address: (r.destination_address as string) ?? "",
      destination_lat: (r.destination_lat as number) ?? null,
      destination_lng: (r.destination_lng as number) ?? null,
      status: r.status as string,
      created_at: r.created_at as string,
      started_at: (r.started_at as string) ?? null,
      completed_at: (r.completed_at as string) ?? null,
      archived_at: (r.archived_at as string) ?? null,
      reservations: {
        service_type: "VTC",
        total_amount: (r.reservation_total_amount as number) ?? 0,
        reservation_date: (r.reservation_date as string) ?? "",
        details: { payment_mode: (r.payment_mode as string) ?? "mobile_money" },
      },
    });

    setPool(poolData);
    setActive(((act ?? []) as Record<string, unknown>[]).map(mapRpcRow));
    setCompleted(((done ?? []) as Record<string, unknown>[]).map(mapRpcRow));

    // Gains : paiements validés par l'admin pour les courses VTC de ce chauffeur
    const { data: earn, error: e3 } = await supabase.rpc("get_driver_vtc_earnings", { _driver_id: user.id });
    if (e3) console.error("[vtc] earnings", e3);
    setEarnings(
      (earn ?? []).map((r: { amount: number; validated_at: string | null; completed_at: string | null }) => ({
        amount: r.amount,
        validated_at: r.validated_at,
        completed_at: r.completed_at,
      }))
    );

    setLoading(false);
  }, [user, isOnline]);

  useEffect(() => {
    if (!user) return;
    load();
    // Anti-rebond : pendant une course, les mises à jour temps réel arrivent
    // par rafales. Sans regroupement, `load()` était relancé plusieurs fois
    // par seconde et figeait l'écran chauffeur sur Android.
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleLoad = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void load(), 500);
    };
    // Listen to ALL trip changes (RLS filters; pool + own trips visible).
    const ch = supabase
      .channel(`chauffeur-vtc-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trips" },
        (payload) => {
          const t = payload.new as {
            id?: string;
            status?: string;
            driver_id?: string | null;
            origin_lat?: number | null;
            origin_lng?: number | null;
            origin_address?: string | null;
            destination_address?: string | null;
            category?: string | null;
          };
          if (isOnlineRef.current && t?.status === "pending" && !t.driver_id && t.id) {
            // Filtre strict par catégorie : un chauffeur ne reçoit que les
            // courses de sa propre catégorie (STANDARD / CONFORT / VIP).
            // Cf. src/lib/vtc-category-filter.ts (couvert par tests unitaires).
            if (!shouldDispatchTripToDriver(driverCategoryRef.current, t.category ?? null)) return;
            const pos = driverPosRef.current;
            let km: number | null = null;
            if (pos && t.origin_lat != null && t.origin_lng != null) {
              km = haversineKm(pos.lat, pos.lng, Number(t.origin_lat), Number(t.origin_lng));
            }
            const withinRange = km == null || km <= 5;

            if (withinRange) {
              const distLabel = km != null ? ` · ${km.toFixed(1)} km` : "";
              const body = `${t.origin_address ?? "Course"}${t.destination_address ? ` → ${t.destination_address}` : ""}${distLabel}`;
              const tripId = t.id;
              showAppNotification("Nouvelle course VTC à proximité", {
                body,
                tag: `vtc-pool-${tripId}`,
                url: `/chauffeur-vtc?tab=pool&trip=${tripId}`,
              });
              toast("Nouvelle course VTC", {
                description: body,
                duration: 20000,
                action: {
                  label: "Voir la course",
                  onClick: () => {
                    setTab("pool");
                    setTimeout(() => {
                      document.getElementById(`vtc-trip-${tripId}`)?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }, 100);
                  },
                },
              });
            }
          }
          scheduleLoad();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips" },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        async (payload) => {
          try {
            const newRow = (payload.new ?? {}) as { id?: string; status?: string; reservation_id?: string; amount?: number };
            const oldRow = (payload.old ?? {}) as { status?: string };
            if (
              payload.eventType === "UPDATE" &&
              newRow.status === "VALIDATED" &&
              oldRow.status !== "VALIDATED" &&
              newRow.reservation_id
            ) {
              const { data: trip } = await supabase
                .from("trips")
                .select("driver_id")
                .eq("reservation_id", newRow.reservation_id)
                .maybeSingle();
              if (trip?.driver_id === user.id) {
                const gross = newRow.amount ?? 0;
                const net = Math.round(gross * (1 - COMMISSION_RATE));
                toast.success(`Paiement validé · ${FCFA(net)} crédités dans votre portefeuille`);
                void showAppNotification("Paiement validé", {
                  body: `${FCFA(net)} crédités (net après commission 10%)`,
                  tag: `payment-${newRow.id}`,
                  url: "/chauffeur-vtc",
                });
              }
            }
          } catch (e) {
            console.error("[vtc] payment notification", e);
          }
          scheduleLoad();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations" },
        scheduleLoad,
      )
      .subscribe();
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(ch);
    };
    // IMPORTANT: deps are only [user, load] — isOnline / driverPos are read via
    // refs above so GPS updates do NOT re-subscribe (which used to cause an
    // infinite reload loop on the chauffeur screen).
  }, [user, load]);


  // Live driver position is published while the chauffeur page is visible.
  // Background tracking is intentionally not used in the mobile application.
  useEffect(() => {
    if (!user || !isOnline) return;
    let lastPushAt = 0;
    let lastLat: number | null = null;
    let lastLng: number | null = null;
    let lastRenderAt = 0;
    let lastRenderLat: number | null = null;
    let lastRenderLng: number | null = null;
    const recordPosition = (lat: number, lng: number, heading: number | null, speed: number | null, accuracy: number | null) => {
      const movedForRender =
        lastRenderLat == null || lastRenderLng == null
          ? true
          : haversineKm(lastRenderLat, lastRenderLng, lat, lng) * 1000 >= 25;
      if (Date.now() - lastRenderAt >= 4000 || movedForRender) {
        lastRenderAt = Date.now();
        lastRenderLat = lat;
        lastRenderLng = lng;
        setDriverPos({ lat, lng });
      }

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
          heading,
          speed,
          accuracy,
          archived_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "driver_id" },
      );
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (position) => recordPosition(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.heading,
        position.coords.speed,
        position.coords.accuracy,
      ),
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
    for (const e of earnings) {
      const ref = e.validated_at || e.completed_at;
      const ts = ref ? new Date(ref) : null;
      if (!ts) continue;
      const amt = e.amount ?? 0;
      if (ts >= startOfDay) { buckets.day.count++; buckets.day.gross += amt; }
      if (ts >= startOfWeek) { buckets.week.count++; buckets.week.gross += amt; }
      if (ts >= startOfMonth) { buckets.month.count++; buckets.month.gross += amt; }
    }
    return buckets;
  }, [earnings]);

  const acceptTrip = async (t: VtcTrip) => {
    setBusyId(t.id);
    const { data, error } = await supabase.rpc("accept_vtc_trip", { _trip_id: t.id });
    setBusyId(null);
    if (error) {
      const msg = error.message || "";
      if (msg.includes("ALREADY_TAKEN")) {
        toast.error("Course déjà prise par un autre chauffeur");
      } else if (msg.includes("DRIVER_NOT_AVAILABLE")) {
        toast.error("Votre GPS ou statut en ligne n'est pas à jour, repassez en ligne puis réessayez.");
      } else {
        toast.error(`Impossible d'accepter la course : ${error.message}`);
      }
      load();
      return;
    }
    if (!data) {
      toast.error("Assignation non confirmée. Rafraîchissez les demandes.");
      load();
      return;
    }
    const paymentMode = (t.reservations?.details as Record<string, unknown> | null | undefined)?.payment_mode;
    const isCash = paymentMode === "cash";
    toast.success(
      isCash
        ? "Course acceptée — 💵 Encaissez le montant en espèces à l'arrivée"
        : "Course acceptée — ✅ Paiement Mobile Money déjà validé",
    );
    try {
      await requestNotificationPermission();
      await showAppNotification("Course VTC acceptée", {
        body: isCash
          ? "Paiement en ESPÈCES à percevoir à l'arrivée."
          : "Paiement Mobile Money déjà validé — rien à percevoir.",
        tag: `vtc-driver-accept-${t.id}`,
      });
    } catch { /* notifications best-effort */ }
    navigate({ to: "/chauffeur/trips", search: { tripId: t.id } });
  };


  const startTrip = async (t: VtcTrip) => {
    // Debounce: ignore taps within 1500ms of the last action on this trip so a
    // "Démarrer" click cannot land on the freshly-mounted "Terminer" button.
    const now = Date.now();
    const last = lastActionAtRef.current[t.id] ?? 0;
    if (now - last < 1500 || busyId === t.id) return;
    lastActionAtRef.current[t.id] = now;

    if (!user) return;
    setBusyId(t.id);
    const { data, error } = await supabase
      .from("trips")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", t.id)
      .eq("driver_id", user.id)
      .not("status", "in", "(active,completed,cancelled)")
      .select("id, status");
    if (error) {
      setBusyId(null);
      console.error("[VTC] startTrip", error);
      toast.error(`Impossible de démarrer : ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      // Already started — silently refresh instead of alarming the driver.
      setBusyId(null);
      load();
      return;
    }
    setTimeout(() => setBusyId(null), 800);
    toast.success("Course démarrée");
    load();
  };

  const askCompleteTrip = (t: VtcTrip) => {
    const now = Date.now();
    const last = lastActionAtRef.current[t.id] ?? 0;
    if (now - last < 1500) return; // ignore taps just after Démarrer
    setConfirmCompleteId(t.id);
  };

  const completeTrip = async (tripId: string) => {
    const t = active.find((x) => x.id === tripId);
    if (!t) return;
    setConfirmCompleteId(null);
    setBusyId(t.id);
    lastActionAtRef.current[t.id] = Date.now();
    try {
      const { completeVtcTrip, formatPoints } = await import("@/lib/vtc-wallet");
      const res = await completeVtcTrip(t.id);
      if (res.paid_via_wallet && res.driver_net > 0) {
        toast.success(`Course terminée — ${formatPoints(res.driver_net)} pts crédités (80%)`);
      } else {
        toast.success("Course terminée");
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "Erreur";
      console.error("[VTC] complete_vtc_trip", e);
      toast.error(`Finalisation : ${msg}`);
    } finally {
      setBusyId(null);
      load();
    }
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
        <div className="mx-auto flex max-w-md justify-end px-4 pb-2">
          <AlertTestButton label="Tester le klaxon" />
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
            onComplete={askCompleteTrip}
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

      <AlertDialog
        open={confirmCompleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmCompleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminer la course ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes bien arrivé à destination ? Cette action clôture la course et l'archive — elle est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmCompleteId) void completeTrip(confirmCompleteId); }}
            >
              Oui, terminer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  // Deux segments : (1) chauffeur → client (prise en charge) et (2) client → destination finale
  const refreshKey = driverPos
    ? `${driverPos.lat.toFixed(3)}-${driverPos.lng.toFixed(3)}`
    : "static";
  const isActive = currentTrip?.status === "active";
  const pickupFrom = driverPos ?? null;
  const { route: pickupRoute } = useOsrmRoute(
    pickupFrom,
    origin,
    Boolean(pickupFrom && origin && !isActive),
    refreshKey,
  );
  const dropoffFrom = isActive && driverPos ? driverPos : origin;
  const { route: dropoffRoute } = useOsrmRoute(
    dropoffFrom,
    destination,
    Boolean(dropoffFrom && destination),
    refreshKey,
  );
  const combinedGeometry: [number, number][] | undefined =
    pickupRoute?.geometry && dropoffRoute?.geometry
      ? [...pickupRoute.geometry, ...dropoffRoute.geometry]
      : pickupRoute?.geometry ?? dropoffRoute?.geometry;

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
                  routePath={combinedGeometry}
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
          {(pickupRoute || dropoffRoute) && currentTrip && (
            <div className="absolute left-3 top-3 z-[400] flex flex-col gap-1 rounded-xl bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur">
              {pickupRoute && !isActive && (
                <span>🚗 Vers client : {pickupRoute.distanceKm.toFixed(1)} km · {pickupRoute.durationMin} min</span>
              )}
              {dropoffRoute && (
                <span>📍 Vers destination : {dropoffRoute.distanceKm.toFixed(1)} km · {dropoffRoute.durationMin} min</span>
              )}
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
            <p className="text-[10px] uppercase text-muted-foreground">Net (−10%)</p>
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
              <Button variant="secondary" aria-label="Klaxonner" title="Je suis arrivé (klaxon)" onClick={async () => {
                playHorn();
                try { await sendHorn(t.reservation_id); toast.success("Klaxon envoyé au client"); }
                catch { toast.error("Impossible de prévenir le client"); }
              }}>
                <Volume2 className="h-4 w-4" />
              </Button>
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
  const now = useSharedClock(1000);
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
          <Card key={t.id} id={`vtc-trip-${t.id}`} className="border-primary/20 scroll-mt-24">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">Nouvelle demande</Badge>
                  {km != null && (
                    <Badge variant="secondary" className="gap-1">
                      <Navigation className="h-3 w-3" /> {km.toFixed(1)} km
                    </Badge>
                  )}
                  {driverPos && t.origin_lat != null && t.origin_lng != null && (
                    <EtaBadge
                      from={{ lat: driverPos.lat, lng: driverPos.lng }}
                      to={{ lat: Number(t.origin_lat), lng: Number(t.origin_lng) }}
                      label="Pickup"
                      showArrival
                    />
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
              {t.origin_lat != null && t.origin_lng != null && t.destination_lat != null && t.destination_lng != null && (
                <Button
                  asChild
                  variant="outline"
                  className="mt-3 w-full gap-2"
                  size="sm"
                >
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${t.origin_lat},${t.origin_lng}&destination=${t.destination_lat},${t.destination_lng}&travelmode=driving`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="h-4 w-4" />
                    Voir l&apos;itinéraire
                  </a>
                </Button>
              )}
              <Button
                onClick={() => onAccept(t)}
                disabled={busyId === t.id}
                className="mt-3 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
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
