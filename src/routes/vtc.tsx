import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calendar, CarFront, ChevronDown, Clock, Gem, Loader2, MapPin, Navigation, Sparkles, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermission, showAppNotification } from "@/lib/notifications";

type VehicleType = "eco" | "berline" | "confort" | "premium" | "4x4" | "suv" | "van" | "minibus";
type FareCategory = "classique" | "vip";

type FareOption = {
  id: string;
  category: FareCategory;
  zone: string;
  service: string;
  price: number;
  hint?: string;
};

const BERLINE_MODELS = [
  "Toyota Yaris",
  "Toyota Corolla",
  "Toyota Starlet",
  "Suzuki Swift",
  "Suzuki Baleno",
  "Hyundai Sonata",
  "Hyundai Advance",
  "Hyundai i30",
  "Hyundai i40",
  "KIA Picanto",
  "KIA Morning",
  "KIA K3",
  "KIA K5",
  "KIA K7",
];

const VEHICLES: Record<VehicleType, { label: string; seats: string; examples?: string }> = {
  eco: { label: "Éco", seats: "1–3 passagers" },
  berline: {
    label: "Berline",
    seats: "1–3 passagers",
    examples: "Toyota Yaris, Corolla, Starlet · Suzuki Swift, Baleno · Hyundai Sonata, Advance, i30, i40 · KIA Picanto, Morning, K3, K5, K7",
  },
  confort: { label: "Confort", seats: "1–4 passagers" },
  premium: { label: "Premium", seats: "1–3 passagers" },
  "4x4": { label: "4x4", seats: "1–4 passagers" },
  suv: { label: "SUV", seats: "1–5 passagers" },
  van: { label: "Van", seats: "1–7 passagers" },
  minibus: { label: "Minibus", seats: "8–14 passagers" },
};

const formatXAF = (amount: number) => new Intl.NumberFormat("fr-GA", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(amount);

const FARE_CATEGORIES: Record<FareCategory, { title: string; subtitle: string; icon: typeof CarFront }> = {
  classique: { title: "VTC classique", subtitle: "Courses express et forfaits 1h", icon: CarFront },
  vip: { title: "VTC VIP", subtitle: "Confort premium et service prioritaire", icon: Gem },
};

const FARE_OPTIONS: FareOption[] = [
  { id: "classique-akanda-express", category: "classique", zone: "Akanda", service: "Course express", price: 2000 },
  { id: "classique-akanda-1h", category: "classique", zone: "Akanda", service: "Course express 1h", price: 5000 },
  { id: "classique-lbv-express", category: "classique", zone: "Akanda ↔ LBV", service: "Course express", price: 5000 },
  { id: "classique-lbv-1h", category: "classique", zone: "Akanda ↔ LBV", service: "Course express 1h", price: 8000 },
  { id: "classique-owendo-express", category: "classique", zone: "Akanda ↔ Owendo", service: "Course express", price: 8000 },
  { id: "classique-owendo-1h", category: "classique", zone: "Akanda ↔ Owendo", service: "Course express 1h", price: 10000 },
  { id: "vip-akanda-express", category: "vip", zone: "Akanda", service: "Course express", price: 5000 },
  { id: "vip-akanda-1h", category: "vip", zone: "Akanda", service: "Course express 1h", price: 10000 },
  { id: "vip-lbv-express", category: "vip", zone: "Akanda ↔ LBV", service: "Course express", price: 10000 },
  { id: "vip-lbv-1h", category: "vip", zone: "Akanda ↔ LBV", service: "Course express 1h", price: 15000 },
  { id: "vip-owendo-express", category: "vip", zone: "Akanda ↔ Owendo", service: "Course express", price: 15000 },
  { id: "vip-owendo-1h", category: "vip", zone: "Akanda ↔ Owendo", service: "Course express 1h", price: 20000 },
];

const fareCategoryOrder: FareCategory[] = ["classique", "vip"];
const getInstantAvailability = (fare: FareOption) => {
  const minutes = fare.category === "vip" ? 20 : fare.zone.includes("Owendo") ? 18 : fare.zone.includes("LBV") ? 15 : 10;
  return {
    minutes,
    label: `${minutes} min en moyenne`,
    message: `Votre demande est envoyée aux chauffeurs disponibles. Un chauffeur doit confirmer avant le départ ; vous serez notifié dès l’assignation.`,
  };
};

export const Route = createFileRoute("/vtc")({
  head: () => ({
    meta: [
      { title: "VTC / Transfert — Agence Wina" },
      { name: "description", content: "Réservez un transfert privé VTC depuis votre hôtel vers un circuit, bus ou autre destination." },
    ],
  }),
  component: VtcPage,
});

function getInitialSearch() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function VtcPage() {
  const search = getInitialSearch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [pickup, setPickup] = useState(search.get("pickup") || "Mon hôtel");
  const [destination, setDestination] = useState(search.get("destination") || "");
  const [scheduledAt, setScheduledAt] = useState(search.get("scheduled_at") || "");
  const [vehicle, setVehicle] = useState<VehicleType>((search.get("vehicle") as VehicleType) || "berline");
  const [berlineModel, setBerlineModel] = useState(BERLINE_MODELS[0]);
  const [selectedFareId, setSelectedFareId] = useState(search.get("fare") || FARE_OPTIONS[0].id);
  const [passengers, setPassengers] = useState(Number(search.get("passengers") || "1"));
  const [durationUnit, setDurationUnit] = useState<"hours" | "days">("hours");
  const [durationValue, setDurationValue] = useState(1);
  const [rideTiming, setRideTiming] = useState<"now" | "scheduled">("scheduled");
  const [loading, setLoading] = useState(false);

  const selectedFare = useMemo(() => FARE_OPTIONS.find((fare) => fare.id === selectedFareId) ?? FARE_OPTIONS[0], [selectedFareId]);
  const isHourlyFare = selectedFare.service.includes("1h");
  const billableHours = isHourlyFare ? Math.max(1, durationValue) * (durationUnit === "days" ? 24 : 1) : 1;
  const estimate = selectedFare.price * billableHours;
  const instantAvailability = useMemo(() => getInstantAvailability(selectedFare), [selectedFare]);

  const selectFare = (fare: FareOption) => {
    setSelectedFareId(fare.id);
    if (fare.category === "vip") setVehicle("premium");
    if (fare.category === "classique") setVehicle("berline");
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation indisponible sur cet appareil");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setPickup(`Position actuelle (${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)})`),
      () => toast.error("Impossible de récupérer votre position"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver votre VTC");
      navigate({ to: "/connexion" });
      return;
    }
    if (!pickup.trim() || !destination.trim()) {
      toast.error("Départ et arrivée sont obligatoires");
      return;
    }
    if (rideTiming === "scheduled" && !scheduledAt) {
      toast.error("Choisissez une date et heure pour une réservation planifiée");
      return;
    }
    if (passengers < 1) {
      toast.error("Indiquez au moins 1 passager");
      return;
    }
    if (isHourlyFare && durationValue < 1) {
      toast.error("Indiquez une durée valide");
      return;
    }
    setLoading(true);
    try {
      const effectiveScheduledAt = rideTiming === "now" ? new Date().toISOString() : scheduledAt;
      const reservationDate = effectiveScheduledAt.slice(0, 10);
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "VTC" as const,
        reservation_date: reservationDate,
        total_amount: estimate,
        paid_amount: 0,
        details: {
          pickup,
          destination,
          scheduled_at: effectiveScheduledAt,
          ride_timing: rideTiming,
          instant_request: rideTiming === "now",
          availability_estimate_minutes: rideTiming === "now" ? instantAvailability.minutes : null,
          availability_estimate_label: rideTiming === "now" ? instantAvailability.label : null,
          pre_confirmation_message: rideTiming === "now" ? instantAvailability.message : null,
          vehicle_type: VEHICLES[vehicle].label,
          vehicle_model: vehicle === "berline" ? berlineModel : null,
          passengers,
          fare_id: selectedFare.id,
          fare_category: FARE_CATEGORIES[selectedFare.category].title,
          fare_zone: selectedFare.zone,
          fare_service: selectedFare.service,
          duration_unit: isHourlyFare ? durationUnit : "fixed",
          duration_value: isHourlyFare ? durationValue : 1,
          billable_hours: billableHours,
          estimated_price: estimate,
          source: search.get("source") || "direct",
        },
      }).select("id").single();
      if (error) throw error;
      await requestNotificationPermission();
      await showAppNotification("Demande VTC enregistrée", {
        body: rideTiming === "now" ? "Votre demande immédiate a été envoyée." : "Votre transfert VTC a été pré-réservé.",
        tag: `vtc-${data.id}`,
      });
      toast.success(rideTiming === "now" ? "Demande VTC immédiate envoyée" : "Transfert VTC pré-réservé");
      navigate({ to: "/vtc/suivi/$reservationId", params: { reservationId: data.id } });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation VTC");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Hero premium */}
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
              <h1 className="text-2xl font-extrabold leading-tight text-primary-foreground">VTC & Transferts privés</h1>
            </div>
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-primary-foreground/85">
            Chauffeur dédié, tarifs fixes sans surprise. Réservez à la minute ou planifiez votre course.
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-5 max-w-3xl space-y-4 px-4">
        {/* Étape 1 — Tarif (toujours ouvert) */}
        <Section
          step="1"
          title="Choisir votre formule"
          description="Tarifs fixes par zone — sans calcul kilométrique"
          icon={<Sparkles className="h-5 w-5" />}
        >
          <div className="space-y-3">
            {fareCategoryOrder.map((category) => {
              const meta = FARE_CATEGORIES[category];
              const Icon = meta.icon;
              const options = FARE_OPTIONS.filter((fare) => fare.category === category);
              return (
                <div key={category} className="rounded-2xl border bg-secondary/30 p-3">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground">{meta.title}</h3>
                      <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((fare) => {
                      const active = selectedFare.id === fare.id;
                      return (
                        <button
                          key={fare.id}
                          type="button"
                          onClick={() => selectFare(fare)}
                          className={`group relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40 hover:shadow-sm"}`}
                          aria-pressed={active}
                        >
                          {active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />}
                          <span className="block text-sm font-bold text-foreground">{fare.zone}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            {fare.service}
                          </span>
                          <span className="mt-2 block text-base font-extrabold text-primary">{formatXAF(fare.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Étape 2 — Itinéraire */}
        <Section
          step="2"
          title="Votre itinéraire"
          description="Adresse de prise en charge et destination"
          icon={<MapPin className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <Field label="Lieu de départ" icon={<MapPin className="h-4 w-4 text-primary" />}>
              <div className="flex gap-2">
                <input value={pickup} onChange={(e) => setPickup(e.target.value)} className="input-base" placeholder="Hôtel, aéroport, quartier" />
                <button type="button" onClick={useCurrentLocation} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-card hover:bg-primary/5" aria-label="Utiliser ma position">
                  <Navigation className="h-4 w-4 text-primary" />
                </button>
              </div>
            </Field>

            <Field label="Lieu d'arrivée" icon={<MapPin className="h-4 w-4 text-primary" />}>
              <input value={destination} onChange={(e) => setDestination(e.target.value)} className="input-base" placeholder="Circuit, station de bus, hôtel" />
            </Field>
          </div>
        </Section>

        {/* Étape 3 — Moment */}
        <Section
          step="3"
          title="Quand voulez-vous partir ?"
          description={rideTiming === "now" ? "Course immédiate" : "Course planifiée"}
          icon={<Zap className="h-5 w-5" />}
        >
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {([
              { value: "now", label: "Maintenant", icon: Zap },
              { value: "scheduled", label: "Planifier", icon: Calendar },
            ] as const).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRideTiming(option.value)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${rideTiming === option.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  aria-pressed={rideTiming === option.value}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
          {rideTiming === "scheduled" ? (
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-base mt-3" />
          ) : (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed">
              <p className="flex items-center gap-1.5 font-extrabold text-primary">
                <Zap className="h-3.5 w-3.5" /> Disponibilité estimée : {instantAvailability.label}
              </p>
              <p className="mt-1.5 text-muted-foreground">{instantAvailability.message}</p>
            </div>
          )}

          {isHourlyFare && (
            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" /> Durée souhaitée
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  min={1}
                  value={durationValue}
                  onChange={(e) => setDurationValue(Math.max(1, Number(e.target.value) || 1))}
                  className="input-base"
                  aria-label="Nombre d'heures ou de jours"
                />
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card">
                  {(["hours", "days"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setDurationUnit(unit)}
                      className={`min-h-12 px-4 text-xs font-bold transition-colors ${durationUnit === unit ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      {unit === "hours" ? "Heures" : "Jours"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Tarif 1h × durée. 1 jour = 24h.</p>
            </div>
          )}
        </Section>

        {/* Étape 4 — Détails (dépliante) */}
        <CollapsibleSection
          step="4"
          title="Véhicule & passagers"
          description={`${VEHICLES[vehicle].label} · ${passengers} passager(s)`}
          icon={<CarFront className="h-5 w-5" />}
          defaultOpen={false}
        >
          <Field label="Type de véhicule" icon={<CarFront className="h-4 w-4 text-primary" />}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(VEHICLES) as VehicleType[]).map((key) => (
                <button key={key} type="button" onClick={() => setVehicle(key)} className={`min-h-20 rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold transition-all ${vehicle === key ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}>
                  <span className="block font-bold">{VEHICLES[key].label}</span>
                  <span className="text-[10px]">{VEHICLES[key].seats}</span>
                </button>
              ))}
            </div>
            {VEHICLES[vehicle].examples && (
              <div className="mt-3 rounded-xl border bg-secondary/40 p-3 text-xs leading-relaxed">
                <span className="font-bold text-foreground">Exemples : </span>
                <span className="text-muted-foreground">{VEHICLES[vehicle].examples}</span>
              </div>
            )}
          </Field>

          {vehicle === "berline" && (
            <Field label="Modèle berline" icon={<CarFront className="h-4 w-4 text-primary" />}>
              <select value={berlineModel} onChange={(e) => setBerlineModel(e.target.value)} className="input-base">
                {BERLINE_MODELS.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Nombre de passagers" icon={<Users className="h-4 w-4 text-primary" />}>
            <input type="number" min={1} max={7} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="input-base" />
          </Field>
        </CollapsibleSection>

        {/* Récapitulatif premium */}
        <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
          <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Récapitulatif</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-xs text-muted-foreground">Tarif estimé</p>
            <p className="mt-1 text-3xl font-extrabold text-primary">{formatXAF(estimate)}</p>
          </div>
          <div className="grid gap-2 border-t border-border/50 bg-card/50 p-4 text-left text-xs sm:grid-cols-2">
            <SummaryLine label="Formule" value={FARE_CATEGORIES[selectedFare.category].title} />
            <SummaryLine label="Zone" value={selectedFare.zone} />
            <SummaryLine label="Moment" value={rideTiming === "now" ? "Maintenant" : "Planifié"} />
            {rideTiming === "now" && <SummaryLine label="Disponibilité" value={instantAvailability.label} />}
            <SummaryLine label="Service" value={selectedFare.service} />
            <SummaryLine label="Prix de base" value={formatXAF(selectedFare.price)} />
            {isHourlyFare && <SummaryLine label="Durée" value={`${durationValue} ${durationUnit === "hours" ? "h" : "jour(s)"} · ${billableHours}h`} />}
          </div>
        </div>

        <button type="button" onClick={submit} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CarFront className="h-4 w-4" />}
          {loading ? "Réservation..." : rideTiming === "now" ? "Commander un VTC maintenant" : "Réserver mon transfert VTC"}
        </button>
      </main>

      <ClientNav />
      <style>{`.input-base{width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--card));padding:.75rem;font-size:.875rem;transition:border-color .15s,box-shadow .15s}.input-base:focus{outline:none;border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.15)}`}</style>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">{icon} {label}</label>
      {children}
    </div>
  );
}

function Section({ step, title, description, icon, children }: { step: string; title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b border-border/50 bg-secondary/40 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Étape {step}</p>
          <h2 className="truncate text-sm font-extrabold text-foreground">{title}</h2>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CollapsibleSection({ step, title, description, icon, children, defaultOpen = false }: { step: string; title: string; description?: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border/50 bg-secondary/40 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Étape {step} · {open ? "Ouvert" : "Toucher pour déplier"}</p>
          <h2 className="truncate text-sm font-extrabold text-foreground">{title}</h2>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-3 p-4">{children}</div>}
    </section>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="truncate text-right font-semibold text-foreground">{value}</span>
    </p>
  );
}
