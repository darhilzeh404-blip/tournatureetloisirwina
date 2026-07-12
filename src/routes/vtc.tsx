import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar, CarFront, Check, CheckCircle2, ChevronDown, Clock, Gem, Heart,
  Loader2, MapPin, Navigation, Sparkles, Users, Zap, Crown, ArrowRight, Star,
  Search, AlertCircle, Timer, Radar,
} from "lucide-react";
import { toast } from "sonner";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { VtcZoneMap, type AvailableDriver } from "@/components/VtcZoneMap";
import { VtcDestinationSearch } from "@/components/VtcDestinationSearch";
import { NumberInput } from "@/components/ui/number-input";
import {
  computeFare, detectZone, formatXAF, zoneLabel, ZONES,
  type RideMode, type VehicleCategory, type ZoneId,
} from "@/lib/vtc-zones";
import kiaK7Bg from "@/assets/kia-k7-vtc.jpg";


export const Route = createFileRoute("/vtc")({
  head: () => ({
    meta: [
      { title: "VTC & Mariage — Agence Wina" },
      { name: "description", content: "Réservez un VTC Standard, Confort, VIP ou un véhicule de mariage à Libreville, Akanda et Owendo. Tarifs fixes par zone." },
    ],
  }),
  component: VtcPage,
});

// ─── Catégories de véhicules ────────────────────────────────────────────────
type CatMeta = {
  id: VehicleCategory;
  title: string;
  subtitle: string;
  models: string[];
  usage: string;
  icon: string;
};

const CATEGORIES: CatMeta[] = [
  {
    id: "standard",
    title: "VTC Standard",
    subtitle: "Citadines & Compactes",
    models: [
      "Toyota Yaris",
      "Toyota Starlet",
      "Suzuki Swift",
      "Suzuki Baleno",
      "Kia Picanto",
      "Kia Morning"
    ],
    usage: "Courses urbaines rapides et trajets express.",
    icon: "/icons/standard-3d.png"
  },

  {
    id: "confort",
    title: "VTC Confort",
    subtitle: "Berlines & Familiales",
    models: [
      "Toyota Corolla",
      "Hyundai Sonata",
      "Hyundai Advance",
      "Hyundai i30",
      "Hyundai i40",
      "Kia K3",
      "Kia K5"
    ],
    usage: "Trajets plus longs et confort accru. (+30 % vs Standard)",
    icon: "/icons/confort-3d.jpg"
  },

  {
    id: "vip",
    title: "VTC VIP",
    subtitle: "Luxe & Prestige",
    models: [
      "Kia K7",
      "Berlines de haut standing"
    ],
    usage: "Mariages, événements VIP, clientèle d'affaires.",
    icon: "/icons/vip-3d.jpg"
  }
];

const WEDDING_FARES = {
  berline: { h12: 100_000, h24: 200_000, label: "Berline VIP" },
  suv:     { h12: 200_000, h24: 400_000, label: "SUV VIP" },
} as const;
type WeddingVehicle = keyof typeof WEDDING_FARES;
type WeddingDuration = "h12" | "h24";

type MainTab = "course" | "mariage";

function VtcPage() {
  const [tab, setTab] = useState<MainTab>("course");

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background pb-32">
      {/* Header premium compact, glass, coins inférieurs arrondis */}
      <section className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-primary via-primary to-primary/85 px-5 pb-6 pt-7 shadow-lg shadow-primary/20">
        <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary-foreground blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/60 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-md ring-1 ring-primary-foreground/25">
              <CarFront className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">Service Premium</p>
              <h1 className="text-xl font-extrabold leading-tight text-primary-foreground">VTC & Mariage</h1>
            </div>
          </div>
          <p className="mt-2 max-w-md text-[12.5px] leading-snug text-primary-foreground/85">
            Tarifs fixes par zone · Standard, Confort, VIP — ou véhicule de mariage avec chauffeur dédié.
          </p>

          {/* Pills tabs iOS (sliding) */}
          <div className="relative mt-4 grid grid-cols-2 gap-1 rounded-full bg-primary-foreground/15 p-1 backdrop-blur-md ring-1 ring-primary-foreground/20">
            {([
              { v: "course",  l: "Course",  i: CarFront },
              { v: "mariage", l: "Mariage", i: Heart },
            ] as const).map((t) => {
              const I = t.i;
              const active = tab === t.v;
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTab(t.v)}
                  className="relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors"
                  aria-pressed={active}
                >
                  {active && (
                    <motion.span
                      layoutId="vtc-tab-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-primary-foreground shadow-sm"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <I className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-primary-foreground"}`} />
                  <span className={active ? "text-primary" : "text-primary-foreground"}>{t.l}</span>
                </button>
              );
            })}
          </div>

          <Link
            to="/deplacement-groupe"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-[11.5px] font-semibold text-primary-foreground ring-1 ring-primary-foreground/25 backdrop-blur-md transition hover:bg-primary-foreground/25"
          >
            <Users className="h-3.5 w-3.5" />
            Covoiturage · Voyager en groupe
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <main className="mx-auto -mt-3 max-w-3xl px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-2.5"
          >
            {tab === "course" ? <CourseFlow /> : <MariageFlow />}
          </motion.div>
        </AnimatePresence>

        <PremiumRangesSection onCourse={() => setTab("course")} />
      </main>

      <ClientNav />
      <style>{`.input-base{width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--card));padding:.6rem .75rem;font-size:.875rem;transition:border-color .15s,box-shadow .15s}.input-base:focus{outline:none;border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.15)}`}</style>
    </div>
  );
}

// ─── Wizard state (locks selections & enforces order) ───────────────────────
function useWizard(steps: string[]) {
  const [openId, setOpenIdState] = useState<string | null>(steps[0] ?? null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const indexOf = (id: string) => steps.indexOf(id);
  const isConfirmed = (id: string) => confirmedIds.has(id);
  const canOpen = (id: string) => {
    const i = indexOf(id);
    if (i <= 0) return true;
    return confirmedIds.has(steps[i - 1]);
  };

  const invalidateFrom = (id: string) => {
    const i = indexOf(id);
    if (i < 0) return;
    setConfirmedIds((prev) => {
      const next = new Set(prev);
      steps.slice(i).forEach((s) => next.delete(s));
      return next;
    });
  };

  const setOpenId = (id: string | null) => {
    if (id === null) { setOpenIdState(null); return; }
    if (!canOpen(id)) {
      toast.info("Confirmez l'étape précédente d'abord");
      return;
    }
    // Re-opening a confirmed step invalidates it + downstream to keep coherence
    if (confirmedIds.has(id)) invalidateFrom(id);
    setOpenIdState(id);
  };

  const confirm = (id: string) => {
    setConfirmedIds((prev) => new Set(prev).add(id));
    const i = indexOf(id);
    const next = steps[i + 1] ?? null;
    setOpenIdState(next);
  };

  const allConfirmed = steps.every((s) => confirmedIds.has(s));

  return { openId, setOpenId, isConfirmed, canOpen, confirm, allConfirmed, invalidateFrom };
}

type WizardCtx = ReturnType<typeof useWizard>;

// ─── Accordion premium (une seule carte ouverte, avec confirmation) ─────────
function AccordionCard({
  id, wizard, title, summary, icon, children, canConfirm = true, confirmLabel = "Choisir",
}: {
  id: string;
  wizard: WizardCtx;
  title: string;
  summary?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  canConfirm?: boolean;
  confirmLabel?: string;
}) {
  const open = wizard.openId === id;
  const confirmed = wizard.isConfirmed(id);
  const locked = !wizard.canOpen(id) && !open;

  return (
    <motion.section
      layout
      transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
      className={`overflow-hidden rounded-3xl border bg-card/90 backdrop-blur-sm transition-shadow ${
        open ? "border-primary/30 shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.35)]"
             : confirmed ? "border-primary/20 shadow-sm"
             : "border-border/60 shadow-sm"
      } ${locked ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={() => wizard.setOpenId(open ? null : id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.995] transition-transform"
        aria-expanded={open}
        aria-disabled={locked}
      >
        <motion.div
          animate={{ scale: open ? 1.05 : 1 }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            open ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                 : confirmed ? "bg-primary/15 text-primary"
                 : "bg-primary/10 text-primary"
          }`}
        >
          {confirmed && !open ? <CheckCircle2 className="h-4 w-4" /> : icon}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[14px] font-bold text-foreground">{title}</h2>
            {confirmed && !open && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                <Check className="h-2.5 w-2.5" /> OK
              </span>
            )}
          </div>
          {summary && <p className="truncate text-[12px] text-muted-foreground">{summary}</p>}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {children}
              <button
                type="button"
                onClick={() => {
                  if (!canConfirm) { toast.error("Complétez cette étape avant de continuer"); return; }
                  wizard.confirm(id);
                }}
                disabled={!canConfirm}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[13.5px] font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {confirmLabel}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COURSE VTC
// ════════════════════════════════════════════════════════════════════════════

type LatLng = { lat: number; lng: number } | null;

function CourseFlow() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const wizard = useWizard(["cat", "route", "mode", "when"]);
  const [category, setCategory] = useState<VehicleCategory>("standard");
  const [mode, setMode] = useState<RideMode>("express");
  const [pickupLabel, setPickupLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [pickup, setPickup] = useState<LatLng>(null);
  const [destination, setDestination] = useState<LatLng>(null);
  const [selecting, setSelecting] = useState<"pickup" | "destination" | null>("pickup");
  const [scheduledAt, setScheduledAt] = useState("");
  const [rideTiming, setRideTiming] = useState<"now" | "scheduled">("scheduled");
  const [hours, setHours] = useState(1);
  const [passengers, setPassengers] = useState(1);
  const [model, setModel] = useState(CATEGORIES[0].models[0]);
  const [loading, setLoading] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  type DriverInfo = { full_name: string | null; vehicle_type: string | null; license_plate: string | null };
  const [driverInfos, setDriverInfos] = useState<Record<string, DriverInfo>>({});
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Charger les chauffeurs VTC disponibles autour du client dès qu'un départ est défini
  useEffect(() => {
    if (!pickup) { setAvailableDrivers([]); setDriverInfos({}); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const { data: drs } = await supabase
          .from("drivers")
          .select("user_id, full_name, vehicle_type, license_plate, category")
          .eq("category", category.toUpperCase() as "STANDARD" | "CONFORT" | "VIP");

        const rows = drs ?? [];
        const ids = rows.map((d) => d.user_id).filter(Boolean) as string[];
        if (ids.length === 0) { if (!cancelled) { setAvailableDrivers([]); setDriverInfos({}); } return; }
        const infos: Record<string, DriverInfo> = {};
        rows.forEach((d) => {
          infos[d.user_id as string] = {
            full_name: d.full_name ?? null,
            vehicle_type: d.vehicle_type ?? null,
            license_plate: d.license_plate ?? null,
          };
        });
        const { data: pos } = await supabase
          .from("driver_positions")
          .select("driver_id, latitude, longitude, heading")
          .in("driver_id", ids)
          .is("archived_at", null);
        if (cancelled) return;
        setDriverInfos(infos);
        setAvailableDrivers(
          (pos ?? []).map((p) => ({
            id: p.driver_id as string,
            lat: Number(p.latitude),
            lng: Number(p.longitude),
            heading: p.heading != null ? Number(p.heading) : null,
          })),
        );
      } catch { /* silencieux */ }
    };
    load();
    const t = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [pickup, category]);

  // Distance haversine pour chaque chauffeur, triés du plus proche au plus loin
  const driversWithDistance = useMemo(() => {
    if (!pickup) return [] as Array<AvailableDriver & { km: number; etaMin: number }>;
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    return availableDrivers
      .map((d) => {
        const dLat = toRad(d.lat - pickup.lat);
        const dLng = toRad(d.lng - pickup.lng);
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(pickup.lat)) * Math.cos(toRad(d.lat)) * Math.sin(dLng / 2) ** 2;
        const km = 2 * R * Math.asin(Math.sqrt(a));
        return { ...d, km, etaMin: Math.max(1, Math.round((km / 30) * 60)) };
      })
      .sort((a, b) => a.km - b.km);
  }, [pickup, availableDrivers]);

  const nearest = driversWithDistance[0] ?? null;
  const focusedId = selectedDriverId ?? nearest?.id ?? null;
  const focusedDriver = focusedId ? driversWithDistance.find((d) => d.id === focusedId) ?? null : null;
  const nearestDriver = focusedId ? driverInfos[focusedId] ?? null : null;

  useEffect(() => {
    const list = CATEGORIES.find((c) => c.id === category)!.models;
    if (!list.includes(model)) setModel(list[0]);
  }, [category, model]);

  const fare = useMemo(
    () => computeFare({
      fromLat: pickup?.lat, fromLng: pickup?.lng,
      toLat: destination?.lat, toLng: destination?.lng,
      category, mode,
    }),
    [pickup, destination, category, mode],
  );

  const billableHours = mode === "hour" ? Math.max(1, hours) : 1;
  const total = fare.ok ? fare.price * billableHours : 0;

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error("Géolocalisation indisponible"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude;
        setPickup({ lat, lng });
        const z = detectZone(lat, lng);
        setPickupLabel(`Ma position (${zoneLabel(z)})`);
        setSelecting("destination");
        if (!z) toast.warning("Vous semblez hors des zones desservies.");
      },
      () => toast.error("Impossible d'obtenir votre position"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onPick = (pt: { lat: number; lng: number }, zone: ZoneId | null) => {
    if (!selecting) return;
    if (selecting === "pickup") {
      setPickup(pt); setPickupLabel(`Point sur carte (${zoneLabel(zone)})`); setSelecting("destination");
    } else {
      setDestination(pt); setDestLabel(`Point sur carte (${zoneLabel(zone)})`); setSelecting(null);
    }
    if (!zone) toast.warning("Ce point est hors des zones desservies.");
  };

  const submit = async () => {
    if (!isAuthenticated || !user) { toast.error("Connectez-vous pour réserver"); navigate({ to: "/connexion" }); return; }
    if (!fare.ok) { toast.error(fare.reason || "Trajet invalide"); return; }
    if (rideTiming === "scheduled" && !scheduledAt) { toast.error("Choisissez une date et heure"); return; }
    setLoading(true);
    try {
      const effectiveScheduledAt = rideTiming === "now" ? new Date().toISOString() : scheduledAt;
      // Heures de nuit (22h → 06h) : paiement cash au chauffeur ; sinon paiement mobile money intégral avant dispatch.
      const rideHour = new Date(effectiveScheduledAt).getHours();
      const isNight = rideHour >= 22 || rideHour < 6;
      const paymentMode: "cash" | "mobile_money" = isNight ? "cash" : "mobile_money";

      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "VTC" as const,
        reservation_date: effectiveScheduledAt.slice(0, 10),
        total_amount: total,
        paid_amount: 0,
        paiement_valide: isNight,
        status: isNight ? ("CONFIRMED" as const) : ("PENDING_PAYMENT" as const),
        details: {
          flow: "vtc_course", category,
          category_label: CATEGORIES.find((c) => c.id === category)!.title,
          model, mode,
          mode_label: mode === "express" ? "Course express" : "Course express 1h",
          billable_hours: billableHours, passengers,
          pickup: { ...pickup, label: pickupLabel, zone: fare.zoneFrom },
          destination: { ...destination, label: destLabel, zone: fare.zoneTo },
          scheduled_at: effectiveScheduledAt, ride_timing: rideTiming,
          unit_price: fare.price, base_standard_price: fare.base, estimated_total: total,
          auto_dispatch: true,
          payment_mode: paymentMode,
        },
      }).select("id").single();
      if (error) throw error;

      if (!isNight) {
        // Débit auto du portefeuille VTC Points (refus si solde insuffisant)
        try {
          const { payReservationWithWallet } = await import("@/lib/vtc-wallet");
          await payReservationWithWallet(data.id);
          toast.success("Course payée depuis votre portefeuille ✅");
        } catch (e) {
          const { walletErrorMessage } = await import("@/lib/vtc-wallet");
          await supabase.from("reservations").delete().eq("id", data.id);
          toast.error(walletErrorMessage(e));
          return;
        }
      }

      // Nuit : dispatch immédiat, paiement cash au chauffeur.
      const { data: createdTrip, error: tripErr } = await supabase.from("trips").insert({
        reservation_id: data.id,
        client_id: user.id,
        driver_id: null,
        status: "pending",
        origin_address: pickupLabel || "Point de prise en charge",
        origin_lat: pickup?.lat ?? null,
        origin_lng: pickup?.lng ?? null,
        destination_address: destLabel || "Destination",
        destination_lat: destination?.lat ?? null,
        destination_lng: destination?.lng ?? null,
      }).select("id, origin_lat, origin_lng").maybeSingle();
      if (tripErr || !createdTrip) {
        console.error("[VTC] erreur création trip", tripErr);
        throw new Error(tripErr?.message || "La course VTC n'a pas pu être créée.");
      }
      try {
        if (createdTrip?.origin_lat != null && createdTrip?.origin_lng != null) {
          const { triggerDriverSearch } = await import("@/lib/vtc-dispatch");
          const result = await triggerDriverSearch(
            createdTrip.id,
            Number(createdTrip.origin_lat),
            Number(createdTrip.origin_lng),
          );
          if (result.nearbyCount === 0) {
            toast.info("Demande envoyée. Aucun chauffeur proche détecté pour l'instant, elle reste visible dès qu'un chauffeur revient en ligne.");
          }
        }
      } catch (e) {
        console.error("[VTC] triggerDriverSearch", e);
      }

      await requestNotificationPermission();
      await showAppNotification("Demande VTC enregistrée", { tag: `vtc-${data.id}` });
      if (isNight) {
        toast.success("Course de nuit : payez en espèces au chauffeur à l'arrivée 💵");
      }
      navigate({ to: "/vtc/suivi/$reservationId", params: { reservationId: data.id } });

    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la réservation");
    } finally { setLoading(false); }
  };



  const activeCat = CATEGORIES.find((c) => c.id === category)!;

  return (
    <>
      <AccordionCard id="cat" wizard={wizard}
        title="Catégorie de véhicule" summary={`${activeCat.title} · ${model}`}
        icon={<CarFront className="h-4 w-4" />}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                className={`relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] ${active ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border bg-card hover:border-primary/40"}`}
              >
                {active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />}
                <div className="flex items-center gap-2">
                  <div className="flex h-14 w-14 items-center justify-center">
  <img
    src={c.icon}
    alt={c.title}
    className="h-12 w-12 object-contain drop-shadow-lg"
  />
</div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground">{c.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.subtitle}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{c.usage}</p>
              </button>
            );
          })}
        </div>

        <details className="mt-3 group">
          <summary className="flex cursor-pointer items-center justify-between rounded-xl border bg-card px-3 py-2 text-xs font-bold">
            <span>Choisir un modèle ({model})</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {activeCat.models.map((m) => (
              <button key={m} type="button" onClick={() => setModel(m)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${model === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}
              >{m}</button>
            ))}
          </div>
        </details>
      </AccordionCard>

      <AccordionCard id="route" wizard={wizard}
        canConfirm={!!(pickup && destination && fare.ok)}
        title="Itinéraire & zones"
        summary={pickup && destination ? `${zoneLabel(fare.zoneFrom)} → ${zoneLabel(fare.zoneTo)}` : "Sélectionner départ & arrivée"}
        icon={<MapPin className="h-4 w-4" />}
      >
        {/* Barre de recherche destination intelligente (sticky) */}
        <div className="mb-3 space-y-2">
          <VtcDestinationSearch
            sticky
            placeholder="Adresse, quartier, lieu connu…"
            value={destLabel}
            icon={<Search className="h-4 w-4 text-primary" />}
            onSelect={({ lat, lng, label, inZone }) => {
              setDestination({ lat, lng });
              setDestLabel(label);
              setSelecting(null);
              if (!inZone) {
                toast.warning("Cette zone n'est pas encore desservie.");
              }
            }}
            onClear={() => { setDestination(null); setDestLabel(""); }}
          />

          {/* Bannière zone non desservie */}
          <AnimatePresence>
            {destination && fare.zoneTo === null && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] backdrop-blur-md"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-bold text-amber-700">Zone non desservie</p>
                  <p className="mt-0.5 text-amber-700/85">
                    Cette zone n'est pas encore couverte par nos chauffeurs. Choisissez une destination dans Libreville, Akanda ou Owendo.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mb-2 grid grid-cols-3 gap-2">
          {ZONES.map((z) => (
            <div key={z.id} className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-[10.5px]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: z.color }} />
              <span className="truncate font-semibold">{z.label}</span>
            </div>
          ))}
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSelecting("pickup")}
            className={`rounded-xl border-2 p-2 text-left text-xs transition-colors ${selecting === "pickup" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
            <p className="font-bold text-foreground">📍 Départ</p>
            <p className="mt-0.5 truncate text-muted-foreground">{pickupLabel || "Toucher la carte ou GPS"}</p>
          </button>
          <button type="button" onClick={() => setSelecting("destination")}
            className={`rounded-xl border-2 p-2 text-left text-xs transition-colors ${selecting === "destination" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
            <p className="font-bold text-foreground">🏁 Arrivée</p>
            <p className="mt-0.5 truncate text-muted-foreground">{destLabel || "Toucher la carte ou rechercher"}</p>
          </button>
        </div>

        <VtcZoneMap
          pickup={pickup}
          destination={destination}
          selecting={selecting}
          onPick={onPick}
          height="240px"
          availableDrivers={availableDrivers}
          highlightDriverId={focusedId}
        />

        {/* Carte ETA premium */}
        <AnimatePresence>
          {pickup && (
            <motion.div
              key={focusedDriver ? focusedDriver.id : "searching"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card backdrop-blur-md shadow-[0_8px_24px_-15px_hsl(var(--primary)/0.4)]"
            >
              <div className="flex items-center gap-3 p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ${!focusedDriver ? "animate-pulse" : ""}`}>
                  {focusedDriver ? <Timer className="h-5 w-5" /> : <Radar className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  {focusedDriver ? (
                    <>
                      <p className="text-[13px] font-bold text-foreground">
                        {selectedDriverId && selectedDriverId !== nearest?.id
                          ? `Chauffeur sélectionné · ~${focusedDriver.etaMin} min`
                          : `Votre chauffeur peut arriver dans ~${focusedDriver.etaMin} min`}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground">
                        À {focusedDriver.km < 1 ? `${Math.round(focusedDriver.km * 1000)} m` : `${focusedDriver.km.toFixed(1)} km`} · {driversWithDistance.length} véhicule{driversWithDistance.length > 1 ? "s" : ""} disponible{driversWithDistance.length > 1 ? "s" : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-bold text-foreground">Recherche d'un chauffeur…</p>
                      <p className="text-[11.5px] text-muted-foreground">Nous scannons les véhicules autour de vous.</p>
                    </>
                  )}
                </div>
                {selectedDriverId && selectedDriverId !== nearest?.id && (
                  <button
                    type="button"
                    onClick={() => setSelectedDriverId(null)}
                    className="shrink-0 rounded-full border border-border bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-muted"
                  >
                    Plus proche
                  </button>
                )}
              </div>

              {/* Aperçu chauffeur + véhicule focus */}
              <AnimatePresence>
                {focusedDriver && nearestDriver && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-t border-primary/15 bg-card/60"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-extrabold text-primary-foreground shadow-md">
                        {(nearestDriver.full_name?.trim()?.[0] ?? "C").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-bold text-foreground">
                            {nearestDriver.full_name?.trim() || "Chauffeur Wina"}
                          </p>
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                            <Star className="h-2.5 w-2.5 fill-current" /> 4.9
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            <CarFront className="h-3 w-3" />
                            {nearestDriver.vehicle_type || "Véhicule VTC"}
                          </span>
                          {nearestDriver.license_plate && (
                            <span className="rounded-md border border-foreground/15 bg-background px-1.5 py-0.5 font-mono font-bold tracking-wider text-foreground">
                              {nearestDriver.license_plate}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ETA</p>
                        <p className="text-base font-extrabold leading-none text-primary">~{focusedDriver.etaMin}<span className="text-[10px] font-bold"> min</span></p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Liste défilante des chauffeurs disponibles */}
        {pickup && driversWithDistance.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between px-0.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Voitures autour de vous
              </p>
              <span className="text-[11px] font-semibold text-muted-foreground">{driversWithDistance.length}</span>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {driversWithDistance.slice(0, 12).map((d) => {
                const info = driverInfos[d.id];
                const active = d.id === focusedId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDriverId(d.id)}
                    className={`flex w-[180px] shrink-0 flex-col gap-1.5 rounded-2xl border-2 p-2.5 text-left transition-all active:scale-[0.98] ${
                      active
                        ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                        : "border-border/70 bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                          <CarFront className="h-3.5 w-3.5" />
                        </div>
                        <p className="truncate text-[12px] font-bold text-foreground">
                          {info?.full_name?.trim() || "Chauffeur Wina"}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1 py-0.5 text-[9.5px] font-bold text-amber-600">
                        <Star className="h-2.5 w-2.5 fill-current" /> 4.9
                      </span>
                    </div>
                    <p className="truncate text-[10.5px] text-muted-foreground">
                      {info?.vehicle_type || "Véhicule VTC"}
                      {info?.license_plate ? ` · ${info.license_plate}` : ""}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between text-[10.5px]">
                      <span className="inline-flex items-center gap-1 font-bold text-primary">
                        <Timer className="h-3 w-3" /> ~{d.etaMin} min
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        {d.km < 1 ? `${Math.round(d.km * 1000)} m` : `${d.km.toFixed(1)} km`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={useCurrentLocation} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-bold hover:bg-primary/5">
            <Navigation className="h-3.5 w-3.5 text-primary" /> Ma position
          </button>
          {(pickup || destination) && (
            <button type="button" onClick={() => { setPickup(null); setDestination(null); setPickupLabel(""); setDestLabel(""); setSelecting("pickup"); }}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted">
              Réinitialiser
            </button>
          )}
        </div>
      </AccordionCard>

      <AccordionCard id="mode" wizard={wizard}
        title="Formule de course"
        summary={mode === "express" ? "Course express" : `Course 1h × ${hours}`}
        icon={<Zap className="h-4 w-4" />}
      >
        <SegmentedTwo
          value={mode}
          onChange={(v) => setMode(v as RideMode)}
          options={[
            { v: "express", l: "Express", i: Zap },
            { v: "hour",    l: "Course 1h", i: Clock },
          ]}
        />
        {mode === "hour" && (
          <div className="mt-3">
            <Field label="Nombre d'heures" icon={<Clock className="h-4 w-4 text-primary" />}>
              <NumberInput value={hours} onChange={setHours} min={1} max={24} placeholder="1" className="input-base" />
            </Field>
          </div>
        )}
      </AccordionCard>

      <AccordionCard id="when" wizard={wizard}
        canConfirm={(rideTiming === "now" || !!scheduledAt) && passengers >= 1}
        title="Date & passagers"
        summary={`${rideTiming === "now" ? "Maintenant" : scheduledAt || "Planifier"} · ${passengers} pax`}
        icon={<Calendar className="h-4 w-4" />}
        confirmLabel="Valider"
      >
        <SegmentedTwo
          value={rideTiming}
          onChange={(v) => setRideTiming(v as "now" | "scheduled")}
          options={[
            { v: "now", l: "Maintenant", i: Zap },
            { v: "scheduled", l: "Planifier", i: Calendar },
          ]}
        />
        {rideTiming === "scheduled" && (
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-base mt-3" />
        )}
        <div className="mt-3">
          <Field label="Passagers" icon={<Users className="h-4 w-4 text-primary" />}>
            <NumberInput value={passengers} onChange={setPassengers} min={1} max={8} placeholder="1" className="input-base" />
          </Field>
        </div>
      </AccordionCard>

      {/* Récap compact glass */}
      <motion.div layout className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.4)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Tarif estimé</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              {fare.ok ? <>{zoneLabel(fare.zoneFrom)} → {zoneLabel(fare.zoneTo)} · {activeCat.title}</> : (fare.reason || "Sélectionnez départ & arrivée")}
            </p>
          </div>
          <p className="text-2xl font-extrabold text-primary">{fare.ok ? formatXAF(total) : "—"}</p>
        </div>
      </motion.div>

      <StickyContinue
        loading={loading}
        disabled={!fare.ok || !wizard.allConfirmed}
        label={wizard.allConfirmed ? "Continuer · Réserver ma course" : "Confirmez toutes les étapes"}
        loadingLabel="Recherche de chauffeur dans un rayon de 5 km…"
        onClick={submit}
        icon={<CarFront className="h-4 w-4" />}
      />

    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MARIAGE
// ════════════════════════════════════════════════════════════════════════════

function MariageFlow() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const wizard = useWizard(["vehicle", "duration", "info"]);
  const [vehicle, setVehicle] = useState<WeddingVehicle>("berline");
  const [duration, setDuration] = useState<WeddingDuration>("h12");
  const [eventDate, setEventDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const total = WEDDING_FARES[vehicle][duration];
  const minDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16);

  const submit = async () => {
    if (!isAuthenticated || !user) { toast.error("Connectez-vous pour réserver"); navigate({ to: "/connexion" }); return; }
    if (!eventDate) { toast.error("Choisissez la date de l'événement"); return; }
    if (!/^[0-9+\s]{8,15}$/.test(phone)) { toast.error("Numéro de téléphone invalide"); return; }
    if (name.trim().length < 2) { toast.error("Nom requis"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id, service_type: "VTC" as const,
        reservation_date: eventDate.slice(0, 10),
        total_amount: total, paid_amount: 0,
        details: {
          flow: "vtc_mariage",
          vehicle, vehicle_label: WEDDING_FARES[vehicle].label,
          duration, duration_hours: duration === "h12" ? 12 : 24,
          event_date: eventDate, contact_name: name, contact_phone: phone,
          requires_admin_validation: true,
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Réservation mariage créée — procédez au paiement total");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la réservation");
    } finally { setLoading(false); }
  };

  return (
    <>
      <AccordionCard id="vehicle" wizard={wizard}
        title="Véhicule mariage" summary={WEDDING_FARES[vehicle].label}
        icon={<Crown className="h-4 w-4" />}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(WEDDING_FARES) as WeddingVehicle[]).map((v) => {
            const f = WEDDING_FARES[v]; const active = vehicle === v;
            return (
              <button key={v} type="button" onClick={() => setVehicle(v)}
                className={`rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] ${active ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
                <p className="text-[13px] font-extrabold">{f.label}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <PriceRow label="12h" value={formatXAF(f.h12)} />
                  <PriceRow label="24h" value={formatXAF(f.h24)} />
                </div>
              </button>
            );
          })}
        </div>
      </AccordionCard>

      <AccordionCard id="duration" wizard={wizard}
        title="Durée" summary={duration === "h12" ? "12 heures" : "24 heures"}
        icon={<Clock className="h-4 w-4" />}
      >
        <SegmentedTwo
          value={duration}
          onChange={(v) => setDuration(v as WeddingDuration)}
          options={[
            { v: "h12", l: "12 heures" },
            { v: "h24", l: "24 heures" },
          ]}
        />
      </AccordionCard>

      <AccordionCard id="info" wizard={wizard}
        canConfirm={!!eventDate && name.trim().length >= 2 && /^[0-9+\s]{8,15}$/.test(phone)}
        title="Vos informations" summary={name && phone ? `${name} · ${phone}` : "Date & contact"}
        icon={<Calendar className="h-4 w-4" />}
        confirmLabel="Valider"
      >
        <Field label="Date & heure de l'événement">
          <input type="datetime-local" min={minDate} value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input-base" />
        </Field>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom complet">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="input-base" placeholder="Votre nom" />
          </Field>
          <Field label="Téléphone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} className="input-base" placeholder="+241 ..." />
          </Field>
        </div>
      </AccordionCard>

      <motion.div layout className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.4)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Total mariage</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              {WEDDING_FARES[vehicle].label} · {duration === "h12" ? "12h" : "24h"} · paiement total
            </p>
          </div>
          <p className="text-2xl font-extrabold text-primary">{formatXAF(total)}</p>
        </div>
      </motion.div>

      <StickyContinue
        loading={loading}
        disabled={!wizard.allConfirmed}
        label={wizard.allConfirmed ? "Continuer · Payer le total" : "Confirmez toutes les étapes"}
        onClick={submit}
        icon={<Heart className="h-4 w-4" />}
      />
    </>
  );
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function SegmentedTwo<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; l: string; i?: typeof CarFront }[];
}) {
  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
      {options.map((o) => {
        const I = o.i; const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className="relative z-10 flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors">
            {active && (
              <motion.span layoutId={`seg-${options.map((x) => x.v).join("-")}`}
                className="absolute inset-0 -z-10 rounded-lg bg-card shadow-sm ring-1 ring-border/60"
                transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            )}
            {I && <I className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-muted-foreground"}`} />}
            <span className={active ? "text-primary" : "text-muted-foreground"}>{o.l}</span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-[13px] font-medium">{icon} {label}</label>
      {children}
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border/40 pt-1 first:border-t-0 first:pt-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-extrabold text-primary">{value}</span>
    </div>
  );
}

function StickyContinue({
  loading, disabled, label, onClick, icon, loadingLabel,
}: {
  loading: boolean; disabled: boolean; label: string;
  onClick: () => void; icon: React.ReactNode;
  loadingLabel?: string;
}) {
  return (
    <div
      className="fixed inset-x-0 z-40 px-4 md:hidden"
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="mx-auto max-w-md"
      >
        <button
          type="button"
          onClick={onClick}
          disabled={loading || disabled}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground shadow-[0_12px_30px_-10px_hsl(var(--primary)/0.55)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
          {loading ? (loadingLabel ?? "Réservation...") : label}
        </button>

      </motion.div>
    </div>
  );
  // Desktop: also render an inline button below (optional)
}

// ─── Nos Gammes VTC (pills tabs premium) ───────────────────────────────────
type RangeKey = "berline" | "vip";

function PremiumRangesSection({ onCourse: _onCourse }: { onCourse: () => void }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [active, setActive] = useState<RangeKey>("berline");
  const [subscribing, setSubscribing] = useState<RangeKey | null>(null);
  const tabs: { id: RangeKey; label: string; icon: string }[] = [
   { id: "berline", label: "Berline Simple", icon: "/icons/berline-3d.png" },
{ id: "vip", label: "Berline VIP", icon: "/icons/vip-3d.png" },
  ];

  const subscribe = async (plan: "berline_simple" | "berline_vip", amount: number, label: string) => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour souscrire");
      navigate({ to: "/connexion" });
      return;
    }
    setSubscribing(plan === "berline_simple" ? "berline" : "vip");
    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "VTC" as const,
        reservation_date: new Date().toISOString().slice(0, 10),
        total_amount: amount,
        paid_amount: 0,
        details: {
          flow: "vtc_subscription",
          plan,
          plan_label: label,
          duration_label: "1 mois",
          requires_admin_validation: true,
        },
      }).select("id").single();
      if (error) throw error;
      toast.success(`${label} créé — procédez au paiement total`);
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la souscription");
    } finally {
      setSubscribing(null);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mt-8"
      aria-labelledby="vtc-ranges-title"
    >
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-primary">Premium</p>
          <h2 id="vtc-ranges-title" className="text-[17px] font-extrabold text-foreground">
            Nos Gammes VTC
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
          <Star className="h-3 w-3 fill-current" /> Exclusif
        </span>
      </div>

      {/* Pills tabs — scroll horizontal sur mobile */}
      <div
        role="tablist"
        aria-label="Gammes VTC"
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className="relative shrink-0 snap-start"
            >
              <span
                className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${
                  isActive ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="vtc-range-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-primary shadow-[0_8px_22px_-10px_hsl(var(--primary)/0.7)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {!isActive && <span className="absolute inset-0 -z-10 rounded-full border border-border/60 bg-card" />}
                <img
  src={t.icon}
  className="h-5 w-5 object-contain"
  alt={t.label}
/>
              </span>
            </button>
          );
        })}
      </div>

      {/* Carte active */}
      <div className="mt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {active === "berline" && (
              <RangeCard
                badge="Abonnement"
                badgeTone="primary"
                icon="/icons/berline-3d.jpg"
                title="Abonnement Berline Simple"
                price="150.000 XAF"
                priceSuffix="/mois"
                subtitle="Paiement total à la souscription"
                description="Service mensuel avec chauffeur dédié pour vos déplacements quotidiens en berline confortable."
                ctaLabel={subscribing === "berline" ? "Création…" : "Souscrire et payer"}
                ctaDisabled={subscribing !== null}
                onCta={() => subscribe("berline_simple", 150_000, "Abonnement Berline Simple")}
              />
            )}
            {active === "vip" && (
              <RangeCard
                badge="Prestige"
                badgeTone="accent"
                icon="/icons/vip-3d.jpg"
                title="Abonnement Berline VIP"
                price="250.000 XAF"
                priceSuffix="/mois"
                subtitle="Paiement total à la souscription"
                description="Berlines haut de gamme, chauffeur dédié en costume, expérience premium pour clientèle exigeante."
                ctaLabel={subscribing === "vip" ? "Création…" : "Souscrire et payer"}
                ctaDisabled={subscribing !== null}
                onCta={() => subscribe("berline_vip", 250_000, "Abonnement Berline VIP")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function RangeCard({
  badge, badgeTone, icon: Icon, title, price, priceSuffix, subtitle, description, ctaLabel, ctaDisabled, onCta,
}: {
  badge: string;
  badgeTone: "primary" | "accent";
  icon: string;
  title: string;
  price: string;
  priceSuffix?: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCta: () => void | Promise<void>;
}) {
  const toneClasses =
    badgeTone === "accent"
      ? "bg-accent/15 text-accent ring-accent/25"
      : "bg-primary/10 text-primary ring-primary/20";
  return (
    <article className="relative overflow-hidden rounded-3xl border border-border/50 bg-card p-5 shadow-md shadow-foreground/5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-primary/15 to-accent/10 blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
  <img
    src={Icon}
    alt={title}
    className="h-9 w-9 object-contain drop-shadow-lg"
  />
</div>
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${toneClasses}`}>
            <Sparkles className="h-2.5 w-2.5" /> {badge}
          </span>
          <h3 className="mt-1.5 text-[16px] font-extrabold leading-tight text-foreground">{title}</h3>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-between rounded-2xl bg-secondary/50 p-3.5">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Tarif</p>
          <p className="mt-0.5 text-[16px] font-extrabold leading-tight text-foreground">
            {price}
            {priceSuffix && <span className="text-[12px] font-semibold text-muted-foreground">{priceSuffix}</span>}
          </p>
          <p className="mt-0.5 text-[11.5px] font-medium text-primary">{subtitle}</p>
        </div>
        <MapPin className="h-5 w-5 text-primary/60" />
      </div>

      <button
        type="button"
        onClick={onCta}
        disabled={ctaDisabled}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[13.5px] font-bold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.65)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {ctaLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
}

// (Course de groupe retirée — voir /deplacement-groupe pour le nouveau covoiturage.)

