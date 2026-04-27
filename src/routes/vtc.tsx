import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calendar, CarFront, Loader2, MapPin, Navigation, Users } from "lucide-react";
import { toast } from "sonner";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/destinations";

type VehicleType = "eco" | "berline" | "confort" | "premium" | "4x4" | "suv" | "van" | "minibus";

const VEHICLES: Record<VehicleType, { label: string; seats: string; base: number; examples?: string }> = {
  eco: { label: "Éco", seats: "1–3 passagers", base: 12000 },
  berline: {
    label: "Berline",
    seats: "1–3 passagers",
    base: 15000,
    examples: "Toyota Yaris, Corolla, Starlet · Suzuki Swift, Baleno · Hyundai Sonata, Advance, i30, i40 · KIA Picanto, Morning, K3, K5, K7",
  },
  confort: { label: "Confort", seats: "1–4 passagers", base: 18000 },
  premium: { label: "Premium", seats: "1–3 passagers", base: 26000 },
  "4x4": { label: "4x4", seats: "1–4 passagers", base: 22000 },
  suv: { label: "SUV", seats: "1–5 passagers", base: 25000 },
  van: { label: "Van", seats: "1–7 passagers", base: 30000 },
  minibus: { label: "Minibus", seats: "8–14 passagers", base: 45000 },
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
  const [passengers, setPassengers] = useState(Number(search.get("passengers") || "1"));
  const [loading, setLoading] = useState(false);

  const estimate = useMemo(() => {
    const passengerFee = Math.max(0, passengers - 1) * 2500;
    return VEHICLES[vehicle].base + passengerFee;
  }, [passengers, vehicle]);

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
    if (!pickup.trim() || !destination.trim() || !scheduledAt) {
      toast.error("Départ, arrivée et horaire sont obligatoires");
      return;
    }
    if (passengers < 1) {
      toast.error("Indiquez au moins 1 passager");
      return;
    }
    setLoading(true);
    try {
      const reservationDate = scheduledAt.slice(0, 10);
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
          scheduled_at: scheduledAt,
          vehicle_type: VEHICLES[vehicle].label,
          passengers,
          estimated_price: estimate,
          source: search.get("source") || "direct",
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Transfert VTC pré-réservé");
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

        <Field label="Date et heure souhaitées" icon={<Calendar className="h-4 w-4 text-primary" />}>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-base" />
        </Field>

        <Field label="Type de véhicule" icon={<CarFront className="h-4 w-4 text-primary" />}>
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

        <Field label="Nombre de passagers" icon={<Users className="h-4 w-4 text-primary" />}>
          <input type="number" min={1} max={7} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="input-base" />
        </Field>

        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 text-center">
          <p className="text-xs text-muted-foreground">Estimation transfert privé</p>
          <p className="mt-1 text-2xl font-extrabold text-primary">{formatFCFA(estimate)}</p>
        </div>

        <button type="button" onClick={submit} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CarFront className="h-4 w-4" />}
          {loading ? "Réservation..." : "Réserver mon transfert VTC"}
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