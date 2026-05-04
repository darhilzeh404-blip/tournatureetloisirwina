import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar, CarFront, ChevronDown, Clock, Gem, Heart, Loader2, MapPin,
  Navigation, Sparkles, Users, Zap, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { VtcZoneMap } from "@/components/VtcZoneMap";
import {
  computeFare, detectZone, formatXAF, zoneLabel, ZONES,
  type RideMode, type VehicleCategory, type ZoneId,
} from "@/lib/vtc-zones";

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
  icon: typeof CarFront;
};

const CATEGORIES: CatMeta[] = [
  {
    id: "standard",
    title: "VTC Standard",
    subtitle: "Citadines & Compactes",
    models: ["Toyota Yaris", "Toyota Starlet", "Suzuki Swift", "Suzuki Baleno", "Kia Picanto", "Kia Morning"],
    usage: "Courses urbaines rapides et trajets express.",
    icon: CarFront,
  },
  {
    id: "confort",
    title: "VTC Confort",
    subtitle: "Berlines & Familiales",
    models: ["Toyota Corolla", "Hyundai Sonata", "Hyundai Advance", "Hyundai i30", "Hyundai i40", "Kia K3", "Kia K5"],
    usage: "Trajets plus longs et confort accru. (+30 % vs Standard)",
    icon: Sparkles,
  },
  {
    id: "vip",
    title: "VTC VIP",
    subtitle: "Luxe & Prestige",
    models: ["Kia K7", "Berlines de haut standing"],
    usage: "Mariages, événements VIP, clientèle d'affaires.",
    icon: Gem,
  },
];

// ─── Tarifs Mariage ─────────────────────────────────────────────────────────
const WEDDING_FARES = {
  berline: { h12: 100_000, h24: 200_000, label: "Berline VIP" },
  suv:     { h12: 200_000, h24: 400_000, label: "SUV VIP" },
} as const;
type WeddingVehicle = keyof typeof WEDDING_FARES;
type WeddingDuration = "h12" | "h24";

// ─── Page ───────────────────────────────────────────────────────────────────
type MainTab = "course" | "mariage";

function VtcPage() {
  const [tab, setTab] = useState<MainTab>("course");

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-5 pb-10 pt-10">
        <div className="absolute inset-0 opacity-10" aria-hidden>
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary-foreground blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-primary-foreground blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur-sm ring-1 ring-primary-foreground/20">
              <CarFront className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/70">Service Premium</p>
              <h1 className="text-2xl font-extrabold leading-tight text-primary-foreground">VTC & Mariage</h1>
            </div>
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-primary-foreground/85">
            Tarifs fixes par zone (Akanda, Grand Libreville, Owendo). Standard, Confort, VIP — ou véhicule de mariage avec chauffeur dédié.
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-5 max-w-3xl space-y-4 px-4">
        {/* Sélecteur principal */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-1 shadow-sm">
          {([
            { v: "course",  l: "Course VTC", i: CarFront },
            { v: "mariage", l: "Mariage",    i: Heart },
          ] as const).map((t) => {
            const I = t.i;
            const active = tab === t.v;
            return (
              <button
                key={t.v}
                type="button"
                onClick={() => setTab(t.v)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-all ${active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"}`}
                aria-pressed={active}
              >
                <I className="h-4 w-4" />
                {t.l}
              </button>
            );
          })}
        </div>

        {tab === "course" ? <CourseFlow /> : <MariageFlow />}
      </main>

      <ClientNav />
      <style>{`.input-base{width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--card));padding:.75rem;font-size:.875rem;transition:border-color .15s,box-shadow .15s}.input-base:focus{outline:none;border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.15)}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COURSE VTC (Standard / Confort / VIP avec géofencing)
// ════════════════════════════════════════════════════════════════════════════

type LatLng = { lat: number; lng: number } | null;

function CourseFlow() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

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

  // Sélection de modèle adaptée à la catégorie
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
    if (!navigator.geolocation) {
      toast.error("Géolocalisation indisponible");
      return;
    }
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
      setPickup(pt);
      setPickupLabel(`Point sur carte (${zoneLabel(zone)})`);
      setSelecting("destination");
    } else {
      setDestination(pt);
      setDestLabel(`Point sur carte (${zoneLabel(zone)})`);
      setSelecting(null);
    }
    if (!zone) toast.warning("Ce point est hors des zones desservies.");
  };

  const submit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!fare.ok) {
      toast.error(fare.reason || "Trajet invalide");
      return;
    }
    if (rideTiming === "scheduled" && !scheduledAt) {
      toast.error("Choisissez une date et heure");
      return;
    }
    setLoading(true);
    try {
      const effectiveScheduledAt = rideTiming === "now" ? new Date().toISOString() : scheduledAt;
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "VTC" as const,
        reservation_date: effectiveScheduledAt.slice(0, 10),
        total_amount: total,
        paid_amount: 0,
        details: {
          flow: "vtc_course",
          category,
          category_label: CATEGORIES.find((c) => c.id === category)!.title,
          model,
          mode,
          mode_label: mode === "express" ? "Course express" : "Course express 1h",
          billable_hours: billableHours,
          passengers,
          pickup: { ...pickup, label: pickupLabel, zone: fare.zoneFrom },
          destination: { ...destination, label: destLabel, zone: fare.zoneTo },
          scheduled_at: effectiveScheduledAt,
          ride_timing: rideTiming,
          unit_price: fare.price,
          base_standard_price: fare.base,
          estimated_total: total,
        },
      }).select("id").single();
      if (error) throw error;
      await requestNotificationPermission();
      await showAppNotification("Demande VTC enregistrée", { tag: `vtc-${data.id}` });
      toast.success("Demande VTC enregistrée");
      navigate({ to: "/vtc/suivi/$reservationId", params: { reservationId: data.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la réservation");
    } finally {
      setLoading(false);
    }
  };

  const activeCat = CATEGORIES.find((c) => c.id === category)!;

  return (
    <>
      {/* Étape 1 — Catégorie */}
      <Section step="1" title="Catégorie de véhicule" description={activeCat.title} icon={<CarFront className="h-5 w-5" />}>
        <div className="grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40"}`}
                aria-pressed={active}
              >
                {active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />}
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground">{c.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.subtitle}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{c.usage}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border bg-secondary/40 p-3 text-xs">
          <p className="font-bold text-foreground">Modèles {activeCat.title}</p>
          <p className="mt-1 text-muted-foreground">{activeCat.models.join(" · ")}</p>
        </div>

        {/* Sélection modèle (dépliante) */}
        <details className="mt-3 group">
          <summary className="flex cursor-pointer items-center justify-between rounded-xl border bg-card px-3 py-2.5 text-xs font-bold">
            <span>Choisir un modèle précis ({model})</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {activeCat.models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${model === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}
              >{m}</button>
            ))}
          </div>
        </details>
      </Section>

      {/* Étape 2 — Trajet (zones + carte) */}
      <Section step="2" title="Itinéraire & zones" description="Détection automatique de la zone tarifaire" icon={<MapPin className="h-5 w-5" />}>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {ZONES.map((z) => (
            <div key={z.id} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-[11px]">
              <span className="h-3 w-3 rounded-sm" style={{ background: z.color }} />
              <span className="truncate font-semibold">{z.label}</span>
            </div>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelecting("pickup")}
            className={`rounded-xl border-2 p-2 text-left text-xs ${selecting === "pickup" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
          >
            <p className="font-bold text-foreground">📍 Départ</p>
            <p className="mt-0.5 truncate text-muted-foreground">{pickupLabel || "Toucher la carte ou GPS"}</p>
          </button>
          <button
            type="button"
            onClick={() => setSelecting("destination")}
            className={`rounded-xl border-2 p-2 text-left text-xs ${selecting === "destination" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
          >
            <p className="font-bold text-foreground">🏁 Arrivée</p>
            <p className="mt-0.5 truncate text-muted-foreground">{destLabel || "Toucher la carte"}</p>
          </button>
        </div>

        <VtcZoneMap pickup={pickup} destination={destination} selecting={selecting} onPick={onPick} />

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={useCurrentLocation} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-bold hover:bg-primary/5">
            <Navigation className="h-3.5 w-3.5 text-primary" /> Utiliser ma position (départ)
          </button>
          {(pickup || destination) && (
            <button type="button" onClick={() => { setPickup(null); setDestination(null); setPickupLabel(""); setDestLabel(""); setSelecting("pickup"); }} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
              Réinitialiser
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Field label="Adresse départ (note)">
            <input value={pickupLabel} onChange={(e) => setPickupLabel(e.target.value)} className="input-base" placeholder="Hôtel, quartier…" />
          </Field>
          <Field label="Adresse arrivée (note)">
            <input value={destLabel} onChange={(e) => setDestLabel(e.target.value)} className="input-base" placeholder="Destination" />
          </Field>
        </div>
      </Section>

      {/* Étape 3 — Formule */}
      <Section step="3" title="Formule de course" description={mode === "express" ? "Course express" : `Course 1h × ${hours}`} icon={<Zap className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {([
            { v: "express", l: "Course express", i: Zap },
            { v: "hour",    l: "Course 1h",      i: Clock },
          ] as const).map((o) => {
            const I = o.i; const active = mode === o.v;
            return (
              <button key={o.v} type="button" onClick={() => setMode(o.v)} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                <I className="h-4 w-4" />{o.l}
              </button>
            );
          })}
        </div>
        {mode === "hour" && (
          <div className="mt-3">
            <Field label="Nombre d'heures" icon={<Clock className="h-4 w-4 text-primary" />}>
              <input type="number" min={1} value={hours} onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))} className="input-base" />
            </Field>
          </div>
        )}
      </Section>

      {/* Étape 4 — Quand & passagers */}
      <CollapsibleSection
        step="4"
        title="Date & passagers"
        description={`${rideTiming === "now" ? "Maintenant" : scheduledAt || "Planifier"} · ${passengers} pax`}
        icon={<Calendar className="h-5 w-5" />}
      >
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {([
            { v: "now",       l: "Maintenant", i: Zap },
            { v: "scheduled", l: "Planifier",  i: Calendar },
          ] as const).map((o) => {
            const I = o.i; const active = rideTiming === o.v;
            return (
              <button key={o.v} type="button" onClick={() => setRideTiming(o.v)} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                <I className="h-4 w-4" />{o.l}
              </button>
            );
          })}
        </div>
        {rideTiming === "scheduled" && (
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-base mt-3" />
        )}
        <div className="mt-3">
          <Field label="Passagers" icon={<Users className="h-4 w-4 text-primary" />}>
            <input type="number" min={1} max={7} value={passengers} onChange={(e) => setPassengers(Math.max(1, Number(e.target.value) || 1))} className="input-base" />
          </Field>
        </div>
      </CollapsibleSection>

      {/* Récapitulatif */}
      <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Tarif estimé</p>
        </div>
        <div className="p-5 text-center">
          {fare.ok ? (
            <>
              <p className="text-3xl font-extrabold text-primary">{formatXAF(total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {zoneLabel(fare.zoneFrom)} → {zoneLabel(fare.zoneTo)} · {activeCat.title}
                {category === "confort" && " (+30 %)"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{fare.reason || "Sélectionnez votre départ et votre arrivée sur la carte."}</p>
          )}
        </div>
      </div>

      <button type="button" onClick={submit} disabled={loading || !fare.ok} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CarFront className="h-4 w-4" />}
        {loading ? "Réservation..." : "Réserver ma course"}
      </button>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MARIAGE
// ════════════════════════════════════════════════════════════════════════════

function MariageFlow() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [vehicle, setVehicle] = useState<WeddingVehicle>("berline");
  const [duration, setDuration] = useState<WeddingDuration>("h12");
  const [eventDate, setEventDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const total = WEDDING_FARES[vehicle][duration];
  const minDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16);

  const submit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!eventDate) { toast.error("Choisissez la date de l'événement"); return; }
    if (!/^[0-9+\s]{8,15}$/.test(phone)) { toast.error("Numéro de téléphone invalide"); return; }
    if (name.trim().length < 2) { toast.error("Nom requis"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "VTC" as const,
        reservation_date: eventDate.slice(0, 10),
        total_amount: total,
        paid_amount: 0,
        details: {
          flow: "vtc_mariage",
          vehicle, vehicle_label: WEDDING_FARES[vehicle].label,
          duration, duration_hours: duration === "h12" ? 12 : 24,
          event_date: eventDate, contact_name: name, contact_phone: phone,
          requires_admin_validation: true,
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Réservation mariage créée — procédez au paiement (50 %)");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la réservation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Section step="1" title="Véhicule mariage" description={WEDDING_FARES[vehicle].label} icon={<Crown className="h-5 w-5" />}>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(WEDDING_FARES) as WeddingVehicle[]).map((v) => {
            const f = WEDDING_FARES[v];
            const active = vehicle === v;
            return (
              <button key={v} type="button" onClick={() => setVehicle(v)} className={`rounded-xl border-2 p-3 text-left transition-all ${active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40"}`}>
                <p className="text-sm font-extrabold">{f.label}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <PriceRow label="12h" value={formatXAF(f.h12)} />
                  <PriceRow label="24h" value={formatXAF(f.h24)} />
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section step="2" title="Durée" description={duration === "h12" ? "12 heures" : "24 heures"} icon={<Clock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {([
            { v: "h12", l: "12 heures" },
            { v: "h24", l: "24 heures" },
          ] as const).map((o) => {
            const active = duration === o.v;
            return (
              <button key={o.v} type="button" onClick={() => setDuration(o.v)} className={`min-h-12 rounded-lg px-3 text-sm font-bold ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                {o.l}
              </button>
            );
          })}
        </div>
      </Section>

      <Section step="3" title="Vos informations" description="Date & contact" icon={<Calendar className="h-5 w-5" />}>
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
      </Section>

      <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Total mariage</p>
        </div>
        <div className="p-5 text-center">
          <p className="text-3xl font-extrabold text-primary">{formatXAF(total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {WEDDING_FARES[vehicle].label} · {duration === "h12" ? "12h" : "24h"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Acompte de 50 % requis · validation admin</p>
        </div>
      </div>

      <button type="button" onClick={submit} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
        {loading ? "Réservation..." : "Réserver et payer 50 %"}
      </button>
    </>
  );
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">{icon} {label}</label>
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

function Section({ title, description, icon, children }: { step?: string; title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b border-border/50 bg-secondary/40 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-foreground">{title}</h2>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CollapsibleSection({ title, description, icon, children, defaultOpen = false }: { step?: string; title: string; description?: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 border-b border-border/50 bg-secondary/40 px-4 py-3 text-left transition-colors hover:bg-secondary/60" aria-expanded={open}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-foreground">{title}</h2>
          {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : <p className="truncate text-[11px] text-muted-foreground">{open ? "Toucher pour replier" : "Toucher pour déplier"}</p>}
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-3 p-4">{children}</div>}
    </section>
  );
}
