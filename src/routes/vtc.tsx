import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calendar, CarFront, Clock, Gem, Loader2, MapPin, Navigation, Users } from "lucide-react";
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
        service_type: "LOCATION_BUS" as const,
        reservation_date: reservationDate,
        total_amount: estimate,
        paid_amount: 0,
        details: {
          category: "VTC",
          pickup,
          destination,
          scheduled_at: effectiveScheduledAt,
          ride_timing: rideTiming,
          instant_request: rideTiming === "now",
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
    <div className="min-h-screen pb-24">
      <section className="hero-gradient px-5 pb-6 pt-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
              <CarFront className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">VTC / Transfert</h1>
              <p className="text-sm text-primary-foreground/80">Chauffeur privé depuis votre hôtel</p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl space-y-5 px-5 pt-6">
        <section className="space-y-3" aria-labelledby="vtc-tarifs">
          <div>
            <h2 id="vtc-tarifs" className="text-lg font-extrabold text-foreground">Choisir un tarif VTC</h2>
            <p className="text-sm text-muted-foreground">Tarifs fixes, sans calcul au kilométrage.</p>
          </div>

          {fareCategoryOrder.map((category) => {
            const meta = FARE_CATEGORIES[category];
            const Icon = meta.icon;
            const options = FARE_OPTIONS.filter((fare) => fare.category === category);
            return (
              <div key={category} className="rounded-2xl border bg-card p-3 shadow-sm">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
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
                        className={`min-h-24 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"}`}
                        aria-pressed={active}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span>
                            <span className="block text-sm font-bold text-foreground">{fare.zone}</span>
                            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              {fare.service}
                            </span>
                            {fare.hint && <span className="mt-1 block text-xs font-semibold text-primary">{fare.hint}</span>}
                          </span>
                          <span className="shrink-0 text-sm font-extrabold text-primary">{formatXAF(fare.price)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <Field label="Adresse ou lieu de départ" icon={<MapPin className="h-4 w-4 text-primary" />}>
          <div className="flex gap-2">
            <input value={pickup} onChange={(e) => setPickup(e.target.value)} className="input-base" placeholder="Hôtel, aéroport, quartier" />
            <button type="button" onClick={useCurrentLocation} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-card" aria-label="Utiliser ma position">
              <Navigation className="h-4 w-4 text-primary" />
            </button>
          </div>
        </Field>

        <Field label="Adresse ou lieu d’arrivée" icon={<MapPin className="h-4 w-4 text-primary" />}>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} className="input-base" placeholder="Circuit, station de bus, hôtel" />
        </Field>

        <Field label="Moment de la course" icon={<Calendar className="h-4 w-4 text-primary" />}>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card">
            {([
              { value: "now", label: "Maintenant" },
              { value: "scheduled", label: "Planifier" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRideTiming(option.value)}
                className={`min-h-12 px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${rideTiming === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                aria-pressed={rideTiming === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          {rideTiming === "scheduled" ? (
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-base mt-2" />
          ) : (
            <p className="mt-2 rounded-xl border bg-primary/5 p-3 text-xs font-semibold text-primary">Commande immédiate : votre demande est envoyée pour une prise en charge dès que possible.</p>
          )}
        </Field>

        {isHourlyFare && (
          <Field label="Durée souhaitée" icon={<Clock className="h-4 w-4 text-primary" />}>
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
                    className={`min-h-12 px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${durationUnit === unit ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    aria-pressed={durationUnit === unit}
                  >
                    {unit === "hours" ? "Heures" : "Jours"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Le tarif 1h est multiplié par la durée choisie. 1 jour = 24h.</p>
          </Field>
        )}

        <Field label="Véhicule souhaité" icon={<CarFront className="h-4 w-4 text-primary" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(VEHICLES) as VehicleType[]).map((key) => (
              <button key={key} type="button" onClick={() => setVehicle(key)} className={`min-h-20 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors ${vehicle === key ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                <span className="block font-bold">{VEHICLES[key].label}</span>
                <span>{VEHICLES[key].seats}</span>
              </button>
            ))}
          </div>
          {VEHICLES[vehicle].examples && (
            <div className="mt-3 rounded-xl border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Exemples de berlines : </span>
              {VEHICLES[vehicle].examples}
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

        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 text-center">
          <p className="text-xs text-muted-foreground">Tarif sélectionné</p>
          <p className="mt-1 text-2xl font-extrabold text-primary">{formatXAF(estimate)}</p>
          <div className="mt-4 grid gap-2 text-left text-xs text-muted-foreground sm:grid-cols-2">
            <p>Formule : <span className="font-semibold text-foreground">{FARE_CATEGORIES[selectedFare.category].title}</span></p>
            <p>Zone : <span className="font-semibold text-foreground">{selectedFare.zone}</span></p>
            <p>Moment : <span className="font-semibold text-foreground">{rideTiming === "now" ? "Maintenant" : "Planifié"}</span></p>
            <p>Service : <span className="font-semibold text-foreground">{selectedFare.service}</span></p>
            <p>Prix de base : <span className="font-semibold text-foreground">{formatXAF(selectedFare.price)}</span></p>
            {isHourlyFare && <p>Durée : <span className="font-semibold text-foreground">{durationValue} {durationUnit === "hours" ? "h" : "jour(s)"} · {billableHours}h facturées</span></p>}
          </div>
        </div>

        <button type="button" onClick={submit} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CarFront className="h-4 w-4" />}
          {loading ? "Réservation..." : rideTiming === "now" ? "Commander un VTC maintenant" : "Réserver mon transfert VTC"}
        </button>
      </main>

      <ClientNav />
      <style>{`.input-base{width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--card));padding:.75rem;font-size:.875rem}.input-base:focus{outline:none;box-shadow:0 0 0 2px hsl(var(--primary)/.4)}`}</style>
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
