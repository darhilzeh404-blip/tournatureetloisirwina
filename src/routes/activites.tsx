import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Calendar, Home as HomeIcon, MapPin, Loader2, ArrowRight } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DESTINATIONS, ACTIVITIES, formatFCFA, type Destination } from "@/lib/destinations";

export const Route = createFileRoute("/activites")({
  head: () => ({
    meta: [
      { title: "Activités & Tourisme — Agence Wina" },
      { name: "description", content: "Découvrez les activités touristiques au Gabon : excursions, randonnées, pêche et plus." },
    ],
  }),
  component: ActivitesPage,
});

function ActivitesPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [selectedDest, setSelectedDest] = useState<string>("");

  // Read URL ?destination= only on the client, after hydration, to avoid SSR mismatch
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dest = new URLSearchParams(window.location.search).get("destination");
    if (dest) setSelectedDest(dest);
  }, []);
  const [persons, setPersons] = useState(1);
  const [days, setDays] = useState(1);
  const [withLodging, setWithLodging] = useState(false);
  const [withGuide, setWithGuide] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const dest = DESTINATIONS.find((d) => d.id === selectedDest);
  const basePrice = dest ? dest.price * persons * days : 0;
  const lodgingPrice = withLodging ? 25_000 * persons * days : 0;
  const guidePrice = withGuide ? 15_000 * days : 0;
  const totalPrice = basePrice + lodgingPrice + guidePrice;

  const toggleActivity = (id: string) => {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!selectedDest) { toast.error("Choisissez une destination"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "CIRCUIT_TOURISTIQUE" as const,
        reservation_date: new Date().toISOString().split("T")[0],
        total_amount: totalPrice,
        paid_amount: 0,
        details: {
          destination: dest!.name,
          persons,
          days,
          withLodging,
          withGuide,
          activities: selectedActivities,
        },
      });
      if (error) throw error;
      toast.success("Réservation créée ! 🎉");
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="warm-gradient px-5 pb-6 pt-8">
        <h1 className="text-xl font-bold text-accent-foreground">🌴 Activités & Tourisme</h1>
        <p className="mt-1 text-sm text-accent-foreground/70">Explorez les merveilles du Gabon</p>
      </div>

      <div className="space-y-6 px-5 pt-6">
        {/* Destinations */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" /> Choisir une destination
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {DESTINATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDest(d.id)}
                className={`group overflow-hidden rounded-2xl border text-left transition-all ${
                  selectedDest === d.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="relative h-20 overflow-hidden">
                  <img src={d.image} alt={d.name} className="h-full w-full object-cover" loading="lazy" width={800} height={600} />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 text-xs font-bold text-primary-foreground">{d.name}</span>
                </div>
                <div className="bg-card p-2">
                  <p className="text-xs font-bold text-primary">{formatFCFA(d.price)}<span className="font-normal text-muted-foreground">/pers/jour</span></p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" /> Personnes
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPersons(Math.max(1, persons - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card font-bold">−</button>
              <span className="min-w-[2rem] text-center font-bold">{persons}</span>
              <button type="button" onClick={() => setPersons(persons + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card font-bold">+</button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Calendar className="h-4 w-4 text-primary" /> Durée (jours)
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDays(Math.max(1, days - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card font-bold">−</button>
              <span className="min-w-[2rem] text-center font-bold">{days}</span>
              <button type="button" onClick={() => setDays(days + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card font-bold">+</button>
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setWithLodging(!withLodging)}
            className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
              withLodging ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
            }`}
          >
            <HomeIcon className="h-4 w-4" /> Logement
          </button>
          <button
            type="button"
            onClick={() => setWithGuide(!withGuide)}
            className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
              withGuide ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
            }`}
          >
            🧭 Guide
          </button>
        </div>

        {/* Activities */}
        <div>
          <h2 className="mb-3 text-sm font-semibold">Activités souhaitées</h2>
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => toggleActivity(act.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedActivities.includes(act.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {act.icon} {act.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        {selectedDest && (
          <div className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Base ({dest?.name})</span><span className="font-medium">{formatFCFA(basePrice)}</span></div>
              {withLodging && <div className="flex justify-between"><span className="text-muted-foreground">Logement</span><span className="font-medium">{formatFCFA(lodgingPrice)}</span></div>}
              {withGuide && <div className="flex justify-between"><span className="text-muted-foreground">Guide</span><span className="font-medium">{formatFCFA(guidePrice)}</span></div>}
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-extrabold text-primary">
                  <span>Total</span>
                  <span>{formatFCFA(totalPrice)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !selectedDest}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? "Réservation..." : "Réserver cette activité"}
        </button>
      </div>

      <ClientNav />
    </div>
  );
}
