import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Calendar, CarFront, Check, Clock, MapPin, Navigation,
  Search, AlertCircle, Timer, Users, Wallet, Zap, Loader2, Star,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { appToast } from "@/lib/app-toast";
import { requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { LazyVtcZoneMap, type AvailableDriver } from "@/components/LazyVtcZoneMap";
import { VtcDestinationSearch } from "@/components/VtcDestinationSearch";
import { NumberInput } from "@/components/ui/number-input";
import { VtcStepper } from "@/components/vtc/VtcStepper";
import { VtcStateScreen } from "@/components/vtc/VtcStateScreen";
import { CATEGORIES, getCategory } from "@/lib/vtc-categories";
import {
  computeFare, detectZone, formatXAF, zoneLabel, ZONES,
  type RideMode, type VehicleCategory, type ZoneId,
} from "@/lib/vtc-zones";

type LatLng = { lat: number; lng: number } | null;
type DriverInfo = { full_name: string | null; vehicle_type: string | null; license_plate: string | null };

type Phase =
  | { kind: "form" }
  | { kind: "processing"; paid: boolean; dispatched: boolean }
  | { kind: "no_driver"; reservationId: string }
  | { kind: "error"; title: string; description: string; recharge?: boolean };

const STEPS = [
  { id: "route", label: "Trajet" },
  { id: "ride", label: "Véhicule" },
  { id: "payment", label: "Paiement" },
  { id: "recap", label: "Récap" },
];

/**
 * Parcours VTC client en 4 étapes : Trajet → Véhicule & passagers →
 * Paiement → Récapitulatif, avec écrans d'états dédiés.
 *
 * La logique métier est inchangée : tarif par zone, course de nuit (22h–06h)
 * payée en espèces au chauffeur, sinon débit intégral du portefeuille avant
 * dispatch, puis création de la course et recherche de chauffeur dans 5 km.
 */
export function VtcCourseFlow({ category: forcedCategory }: { category?: VehicleCategory }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  const [category, setCategory] = useState<VehicleCategory>(forcedCategory ?? "standard");
  const [model, setModel] = useState(getCategory(forcedCategory ?? "standard").models[0]);
  const [mode, setMode] = useState<RideMode>("express");
  const [hours, setHours] = useState(1);
  const [passengers, setPassengers] = useState(1);
  const [rideTiming, setRideTiming] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  const [pickup, setPickup] = useState<LatLng>(null);
  const [destination, setDestination] = useState<LatLng>(null);
  const [pickupLabel, setPickupLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [selecting, setSelecting] = useState<"pickup" | "destination" | null>("pickup");

  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [driverInfos, setDriverInfos] = useState<Record<string, DriverInfo>>({});
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!forcedCategory) return;
    setCategory(forcedCategory);
    setModel(getCategory(forcedCategory).models[0]);
  }, [forcedCategory]);

  useEffect(() => {
    const list = getCategory(category).models;
    if (!list.includes(model)) setModel(list[0]);
  }, [category, model]);

  // ─── Chauffeurs disponibles autour du départ ─────────────────────────────
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
      } catch { /* silencieux : l'écran reste utilisable sans la liste */ }
    };

    load();
    let t: number | null = null;
    const startPoll = () => { if (t === null) t = window.setInterval(load, 15000); };
    const stopPoll = () => { if (t !== null) { window.clearInterval(t); t = null; } };
    const onVisibility = () => { if (document.hidden) stopPoll(); else { load(); startPoll(); } };
    if (!document.hidden) startPoll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; stopPoll(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [pickup, category]);

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

  const effectiveScheduledAt = rideTiming === "now"
    ? new Date().toISOString()
    : (scheduledAt ? new Date(scheduledAt).toISOString() : "");
  // Paiement VTC : portefeuille uniquement, 24h/24 (espèces supprimées).

  // ─── Solde portefeuille (étape paiement) ─────────────────────────────────
  useEffect(() => {
    if (step < 2 || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { fetchVtcWallet } = await import("@/lib/vtc-wallet");
        const w = await fetchVtcWallet(user.id);
        if (!cancelled) setWalletBalance(w.balance_points);
      } catch { if (!cancelled) setWalletBalance(null); }
    })();
    return () => { cancelled = true; };
  }, [step, user]);


  // ─── Sélection carte / GPS ───────────────────────────────────────────────
  const useCurrentLocation = () => {
    if (!navigator.geolocation) { appToast.error("Géolocalisation indisponible", "Sélectionnez votre départ directement sur la carte."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude;
        setPickup({ lat, lng });
        const z = detectZone(lat, lng);
        setPickupLabel(`Ma position (${zoneLabel(z)})`);
        setSelecting("destination");
        if (!z) appToast.warning("Hors zone desservie", "Votre position semble hors de Libreville, Akanda et Owendo.");
      },
      () => appToast.error("Position introuvable", "Autorisez la localisation ou choisissez votre départ sur la carte."),
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
    if (!zone) appToast.warning("Hors zone desservie", "Ce point n'est pas encore couvert par nos chauffeurs.");
  };

  const canLeaveStep = (index: number) => {
    if (index === 0) return !!(pickup && destination && fare.ok);
    if (index === 1) return passengers >= 1 && (rideTiming === "now" || !!scheduledAt);
    if (index === 2) return true;
    return true;
  };

  const goNext = () => {
    if (!canLeaveStep(step)) {
      if (step === 0) appToast.warning("Trajet incomplet", fare.reason || "Choisissez un départ et une arrivée desservis.");
      else appToast.warning("Étape incomplète", "Renseignez la date et le nombre de passagers.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // ─── Soumission ──────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (!isAuthenticated || !user) {
      appToast.info("Connexion requise", "Connectez-vous pour réserver votre course.");
      navigate({ to: "/connexion" });
      return;
    }
    if (!fare.ok) { appToast.warning("Trajet invalide", fare.reason || "Vérifiez votre itinéraire."); return; }
    if (rideTiming === "scheduled" && !scheduledAt) { appToast.warning("Date manquante", "Choisissez la date et l'heure de la course."); return; }

    setPhase({ kind: "processing", paid: false, dispatched: false });
    let reservationId: string | null = null;

    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "VTC" as const,
        reservation_date: effectiveScheduledAt.slice(0, 10),
        total_amount: total,
        paid_amount: 0,
        paiement_valide: false,
        status: "PENDING_PAYMENT" as const,
        details: {
          flow: "vtc_course", category,
          category_label: getCategory(category).title,
          model, mode,
          mode_label: mode === "express" ? "Course express" : "Course express 1h",
          billable_hours: billableHours, passengers,
          pickup: { ...pickup, label: pickupLabel, zone: fare.zoneFrom },
          destination: { ...destination, label: destLabel, zone: fare.zoneTo },
          scheduled_at: effectiveScheduledAt, ride_timing: rideTiming,
          unit_price: fare.price, base_standard_price: fare.base, estimated_total: total,
          auto_dispatch: true,
          payment_mode: "wallet",
        },
      }).select("id").single();
      if (error) throw error;
      reservationId = data.id;

      try {
        const { payReservationWithWallet } = await import("@/lib/vtc-wallet");
        await payReservationWithWallet(data.id);
      } catch (e) {
        await supabase.from("reservations").delete().eq("id", data.id);
        const msg = String((e as { message?: string })?.message ?? "");
        if (/INSUFFICIENT_POINTS/i.test(msg)) {
          setPhase({
            kind: "error",
            title: "Solde insuffisant",
            description: `Il vous faut ${formatXAF(total)} dans votre portefeuille pour confirmer cette course.`,
            recharge: true,
          });
          return;
        }
        throw e;
      }
      setPhase({ kind: "processing", paid: true, dispatched: false });

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
      if (tripErr || !createdTrip) throw new Error(tripErr?.message || "La course VTC n'a pas pu être créée.");

      let nearbyCount = 1;
      try {
        if (createdTrip.origin_lat != null && createdTrip.origin_lng != null) {
          const { triggerDriverSearch } = await import("@/lib/vtc-dispatch");
          const result = await triggerDriverSearch(
            createdTrip.id, Number(createdTrip.origin_lat), Number(createdTrip.origin_lng),
          );
          nearbyCount = result.nearbyCount;
        }
      } catch (e) {
        console.error("[VTC] triggerDriverSearch", e);
      }
      setPhase({ kind: "processing", paid: true, dispatched: true });

      try {
        await requestNotificationPermission();
        await showAppNotification("Demande VTC enregistrée", { tag: `vtc-${data.id}` });
      } catch { /* best-effort */ }

      if (nearbyCount === 0) {
        setPhase({ kind: "no_driver", reservationId: data.id });
        return;
      }

      appToast.success(
        "Course payée et confirmée",
        `${formatXAF(total)} débités de votre portefeuille.`,
      );
      navigate({ to: "/vtc/suivi/$reservationId", params: { reservationId: data.id } });
    } catch (e) {
      console.error("[VTC] submit", e);
      const { describeError } = await import("@/lib/app-errors");
      const d = describeError(e);
      setPhase({ kind: "error", title: d.title, description: reservationId
        ? `${d.description} Votre demande n'a pas été finalisée.`
        : d.description });
    }
  }, [isAuthenticated, user, fare, rideTiming, scheduledAt, effectiveScheduledAt, total,
      category, model, mode, billableHours, passengers, pickup, destination, pickupLabel, destLabel, navigate]);

  // ─── Écrans d'états ──────────────────────────────────────────────────────
  if (phase.kind === "processing") {
    return (
      <VtcStateScreen
        kind="searching"
        title={phase.dispatched ? "Recherche d'un chauffeur…" : "Traitement de votre course"}
        description="Restez sur cet écran quelques secondes, nous finalisons votre réservation."
        steps={[
          { label: "Création de la réservation", done: true },
          { label: "Débit du portefeuille", done: phase.paid },
          { label: "Recherche d'un chauffeur dans 5 km", done: phase.dispatched },
        ]}
      />
    );
  }

  if (phase.kind === "no_driver") {
    return (
      <VtcStateScreen
        kind="no_driver"
        title="Aucun chauffeur disponible pour l'instant"
        description="Votre demande est enregistrée et payée. Elle sera proposée automatiquement dès qu'un chauffeur repasse en ligne près de vous."
        primaryLabel="Suivre ma demande"
        onPrimary={() => navigate({ to: "/vtc/suivi/$reservationId", params: { reservationId: phase.reservationId } })}
        secondaryLabel="Voir mes réservations"
        onSecondary={() => navigate({ to: "/mes-reservations" })}
        showSupport
      />
    );
  }

  if (phase.kind === "error") {
    return (
      <VtcStateScreen
        kind="error"
        title={phase.title}
        description={phase.description}
        primaryLabel={phase.recharge ? "Recharger mon portefeuille" : "Réessayer"}
        onPrimary={() => {
          if (phase.recharge) navigate({ to: "/wallet/recharger" });
          else { setPhase({ kind: "form" }); setStep(3); }
        }}
        secondaryLabel="Modifier ma course"
        onSecondary={() => { setPhase({ kind: "form" }); setStep(0); }}
        showSupport
      />
    );
  }

  // ─── Formulaire par étapes ───────────────────────────────────────────────
  const activeCat = getCategory(category);

  return (
    <div className="space-y-3">
      <VtcStepper steps={STEPS} current={step} onGoTo={(i) => setStep(i)} />

      <AnimatePresence mode="wait">
        <motion.div
          key={STEPS[step].id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="space-y-3"
        >
          {/* ÉTAPE 1 — TRAJET */}
          {step === 0 && (
            <StepCard title="Où allez-vous ?" subtitle="Départ et arrivée dans Libreville, Akanda ou Owendo." icon={<MapPin className="h-4 w-4" />}>
              <VtcDestinationSearch
                sticky
                placeholder="Adresse, quartier, lieu connu…"
                value={destLabel}
                icon={<Search className="h-4 w-4 text-primary" />}
                onSelect={({ lat, lng, label, inZone }) => {
                  setDestination({ lat, lng });
                  setDestLabel(label);
                  setSelecting(null);
                  if (!inZone) appToast.warning("Zone non desservie", "Choisissez une destination dans nos zones couvertes.");
                }}
                onClear={() => { setDestination(null); setDestLabel(""); }}
              />

              {destination && fare.zoneTo === null && (
                <div className="mt-2 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold text-amber-700">Zone non desservie</p>
                    <p className="mt-0.5 text-amber-700/85">Choisissez une destination dans Libreville, Akanda ou Owendo.</p>
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSelecting("pickup")}
                  className={`rounded-2xl border-2 p-2.5 text-left text-xs transition-colors ${selecting === "pickup" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <p className="font-bold text-foreground">Départ</p>
                  <p className="mt-0.5 truncate text-muted-foreground">{pickupLabel || "Toucher la carte ou GPS"}</p>
                </button>
                <button type="button" onClick={() => setSelecting("destination")}
                  className={`rounded-2xl border-2 p-2.5 text-left text-xs transition-colors ${selecting === "destination" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <p className="font-bold text-foreground">Arrivée</p>
                  <p className="mt-0.5 truncate text-muted-foreground">{destLabel || "Rechercher ou toucher la carte"}</p>
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-2xl border border-border/60">
                <LazyVtcZoneMap
                  pickup={pickup}
                  destination={destination}
                  selecting={selecting}
                  onPick={onPick}
                  height="260px"
                  availableDrivers={availableDrivers}
                  highlightDriverId={nearest?.id ?? null}
                />
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {ZONES.map((z) => (
                  <div key={z.id} className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-[10.5px]">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: z.color }} />
                    <span className="truncate font-semibold">{z.label}</span>
                  </div>
                ))}
              </div>

              {pickup && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Timer className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-[12.5px]">
                    {nearest ? (
                      <>
                        <p className="font-bold text-foreground">Chauffeur le plus proche à ~{nearest.etaMin} min</p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {driversWithDistance.length} véhicule{driversWithDistance.length > 1 ? "s" : ""} {activeCat.title} autour de vous
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-foreground">Aucun véhicule visible pour l'instant</p>
                        <p className="text-[11.5px] text-muted-foreground">Vous pouvez tout de même commander : la demande reste active.</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={useCurrentLocation} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-bold hover:bg-primary/5">
                  <Navigation className="h-3.5 w-3.5 text-primary" /> Ma position
                </button>
                {(pickup || destination) && (
                  <button type="button"
                    onClick={() => { setPickup(null); setDestination(null); setPickupLabel(""); setDestLabel(""); setSelecting("pickup"); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted">
                    Réinitialiser
                  </button>
                )}
              </div>
            </StepCard>
          )}

          {/* ÉTAPE 2 — VÉHICULE, PASSAGERS, DATE */}
          {step === 1 && (
            <>
              <StepCard title="Votre véhicule" subtitle={`${activeCat.title} · ${activeCat.subtitle}`} icon={<CarFront className="h-4 w-4" />}>
                {!forcedCategory && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {CATEGORIES.map((c) => {
                      const active = category === c.id;
                      return (
                        <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                          className={`flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition-all active:scale-[0.98] ${
                            active ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:border-primary/40"}`}>
                          <img src={c.icon} alt="" className="h-10 w-10 shrink-0 object-contain" />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-extrabold text-foreground">{c.title}</p>
                            <p className="truncate text-[10.5px] text-muted-foreground">{c.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Modèle souhaité</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {activeCat.models.map((m) => (
                    <button key={m} type="button" onClick={() => setModel(m)}
                      className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                        model === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </StepCard>

              <StepCard title="Formule & passagers" subtitle="Course express ou mise à disposition à l'heure." icon={<Users className="h-4 w-4" />}>
                <Segmented
                  value={mode}
                  onChange={(v) => setMode(v as RideMode)}
                  options={[{ v: "express", l: "Express", i: Zap }, { v: "hour", l: "Course 1h", i: Clock }]}
                />
                {mode === "hour" && (
                  <LabelledField label="Nombre d'heures" icon={<Clock className="h-4 w-4 text-primary" />}>
                    <NumberInput value={hours} onChange={setHours} min={1} max={24} placeholder="1" className="vtc-input" />
                  </LabelledField>
                )}
                <LabelledField label="Passagers" icon={<Users className="h-4 w-4 text-primary" />}>
                  <NumberInput value={passengers} onChange={setPassengers} min={1} max={8} placeholder="1" className="vtc-input" />
                </LabelledField>
              </StepCard>

              <StepCard title="Quand ?" subtitle="Immédiatement ou à une heure précise." icon={<Calendar className="h-4 w-4" />}>
                <Segmented
                  value={rideTiming}
                  onChange={(v) => setRideTiming(v as "now" | "scheduled")}
                  options={[{ v: "now", l: "Maintenant", i: Zap }, { v: "scheduled", l: "Planifier", i: Calendar }]}
                />
                {rideTiming === "scheduled" && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="vtc-input mt-3"
                  />
                )}
              </StepCard>
            </>
          )}

          {/* ÉTAPE 3 — PAIEMENT */}
          {step === 2 && (
            <StepCard title="Paiement" subtitle="Le règlement sécurise votre course avant l'envoi aux chauffeurs." icon={<Wallet className="h-4 w-4" />}>
              <div className="space-y-2.5">
                <div className={`flex items-start gap-3 rounded-2xl border-2 p-3 border-primary bg-primary/5`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-extrabold text-foreground">Portefeuille WINA</p>
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      Débit immédiat de {formatXAF(total)} à la confirmation.
                    </p>
                    {(
                      <p className="mt-1.5 text-[12px] font-bold text-foreground">
                        Solde : {walletBalance === null ? "…" : formatXAF(walletBalance)}
                        {walletBalance !== null && walletBalance < total && (
                          <span className="ml-1.5 font-semibold text-destructive">insuffisant</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <p className="rounded-2xl bg-secondary/60 p-3 text-[11.5px] font-semibold text-muted-foreground">
                  Le paiement en espèces n'est plus accepté pour les courses VTC : le portefeuille WINA
                  est débité automatiquement, 24h/24 (y compris entre 21h et 06h).
                </p>



                {walletBalance !== null && walletBalance < total && (
                  <button type="button" onClick={() => navigate({ to: "/wallet/recharger" })}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 py-3 text-[13px] font-bold text-primary">
                    Recharger mon portefeuille <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </StepCard>
          )}

          {/* ÉTAPE 4 — RÉCAPITULATIF */}
          {step === 3 && (
            <StepCard title="Récapitulatif" subtitle="Vérifiez les informations avant de commander." icon={<Check className="h-4 w-4" />}>
              <dl className="divide-y divide-border/70 text-[12.5px]">
                <RecapRow label="Départ" value={pickupLabel || "—"} />
                <RecapRow label="Arrivée" value={destLabel || "—"} />
                <RecapRow label="Zones" value={`${zoneLabel(fare.zoneFrom)} → ${zoneLabel(fare.zoneTo)}`} />
                <RecapRow label="Véhicule" value={`${activeCat.title} · ${model}`} />
                <RecapRow label="Formule" value={mode === "express" ? "Course express" : `Mise à disposition ${billableHours} h`} />
                <RecapRow label="Passagers" value={`${passengers}`} />
                <RecapRow
                  label="Départ prévu"
                  value={rideTiming === "now"
                    ? "Immédiatement"
                    : new Date(scheduledAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                />
                <RecapRow label="Paiement" value="Portefeuille WINA" />
              </dl>

              <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary/10 p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Total à régler</p>
                  <p className="text-[11.5px] text-muted-foreground">Tarif fixe par zone, sans surprise.</p>
                </div>
                <p className="text-2xl font-extrabold text-primary">{fare.ok ? formatXAF(total) : "—"}</p>
              </div>

              {nearest && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  <Star className="h-3 w-3 fill-current text-amber-500" />
                  Chauffeur le plus proche à ~{nearest.etaMin} min de votre départ
                </p>
              )}
            </StepCard>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Barre d'action */}
      <div className="sticky bottom-24 z-20 flex gap-2 rounded-3xl border border-border/60 bg-card/95 p-2.5 shadow-lg backdrop-blur-md">
        {step > 0 && (
          <button type="button" onClick={goBack}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 text-[13px] font-bold text-foreground active:scale-[0.98]">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} disabled={!canLeaveStep(step)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[13.5px] font-bold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.98] disabled:opacity-50">
            Continuer <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={!fare.ok}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[13.5px] font-bold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.98] disabled:opacity-50">
            <CarFront className="h-4 w-4" /> Commander · {fare.ok ? formatXAF(total) : "—"}
          </button>
        )}
      </div>

      <style>{`.vtc-input{width:100%;min-height:2.75rem;border-radius:.9rem;border:1px solid hsl(var(--border));background:hsl(var(--card));padding:.6rem .8rem;font-size:16px;transition:border-color .15s,box-shadow .15s}.vtc-input:focus{outline:none;border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.15)}`}</style>
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────
function StepCard({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/95 p-4 shadow-sm backdrop-blur-sm">
      <header className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-extrabold leading-tight text-foreground">{title}</h2>
          {subtitle && <p className="truncate text-[11.5px] text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Segmented({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string; i: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const I = o.i;
        const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border-2 text-[12.5px] font-bold transition-all active:scale-[0.98] ${
              active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
            <I className="h-4 w-4" /> {o.l}
          </button>
        );
      })}
    </div>
  );
}

function LabelledField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-foreground">{icon} {label}</p>
      {children}
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
