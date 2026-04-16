import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Calendar, Clock, ArrowRight, Loader2 } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/destinations";

export const Route = createFileRoute("/reserver-transport")({
  head: () => ({
    meta: [
      { title: "Réserver un transport — Agence Wina" },
      { name: "description", content: "Réservez votre transport à Libreville et au Gabon." },
    ],
  }),
  component: ReserverTransport,
});

const TRANSPORT_PRICES: Record<string, number> = {
  "Libreville → Owendo": 5_000,
  "Libreville → Akanda": 8_000,
  "Libreville → Ntoum": 15_000,
  "Libreville → Cap Esterias": 12_000,
  "Libreville → Kango": 25_000,
};

const ROUTES = Object.keys(TRANSPORT_PRICES);

function ReserverTransport() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"immediate" | "planned">("immediate");
  const [route, setRoute] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);

  const unitPrice = TRANSPORT_PRICES[route] || 0;
  const totalPrice = unitPrice * duration;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      toast.error("Veuillez vous connecter d'abord");
      navigate({ to: "/connexion" });
      return;
    }
    if (!route) { toast.error("Sélectionnez un trajet"); return; }

    setLoading(true);
    try {
      const [pickup, destination] = route.split(" → ");
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "LOCATION_BUS" as const,
        reservation_date: date || new Date().toISOString().split("T")[0],
        total_amount: totalPrice,
        paid_amount: 0,
        details: { pickup, destination, mode, time, duration_hours: duration },
      });
      if (error) throw error;
      toast.success("Réservation créée avec succès !");
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="hero-gradient px-5 pb-6 pt-8">
        <h1 className="text-xl font-bold text-primary-foreground">🚌 Réserver un transport</h1>
        <p className="mt-1 text-sm text-primary-foreground/70">Choisissez votre trajet et réservez en un clic</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-5 pt-6">
        {/* Mode */}
        <div className="grid grid-cols-2 gap-2">
          {(["immediate", "planned"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                mode === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {m === "immediate" ? "⚡ Immédiat" : "📅 Planifié"}
            </button>
          ))}
        </div>

        {/* Route */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary" /> Trajet
          </label>
          <select
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="w-full rounded-xl border bg-card px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Sélectionnez un trajet</option>
            {ROUTES.map((r) => (
              <option key={r} value={r}>{r} — {formatFCFA(TRANSPORT_PRICES[r])}</option>
            ))}
          </select>
        </div>

        {/* Date & time (for planned) */}
        {mode === "planned" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border bg-card px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" /> Heure
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border bg-card px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Duration */}
        <div>
          <label className="mb-1.5 text-sm font-medium">Durée (heures)</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDuration(Math.max(1, duration - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-lg font-bold">−</button>
            <span className="min-w-[3rem] text-center text-lg font-bold">{duration}h</span>
            <button type="button" onClick={() => setDuration(duration + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-lg font-bold">+</button>
          </div>
        </div>

        {/* Price display */}
        {route && (
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">Prix total estimé</p>
            <p className="mt-1 text-2xl font-extrabold text-primary">{formatFCFA(totalPrice)}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !route}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? "Réservation..." : "Réserver maintenant"}
        </button>
      </form>

      <ClientNav />
    </div>
  );
}
