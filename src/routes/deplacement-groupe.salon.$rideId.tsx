import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Clock, Loader2, MapPin, Navigation, User, Users, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { formatXAF } from "@/lib/vtc-zones";
import { GROUP_MAX_SEATS, GROUP_RIDE_STATUS_LABEL } from "@/lib/group-ride";

const supabase = supabaseTyped as any;

export const Route = createFileRoute("/deplacement-groupe/salon/$rideId")({
  head: () => ({ meta: [{ title: "Salle d'attente — Déplacement Groupé" }] }),
  component: SalonPage,
});

function SalonPage() {
  const { rideId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("group_rides").select("*").eq("id", rideId).maybeSingle(),
        supabase.from("group_ride_passengers").select("*").eq("ride_id", rideId).order("seat_index"),
      ]);
      if (!mounted) return;
      setRide(r); setPassengers(p ?? []); setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`group-ride-${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_rides", filter: `id=eq.${rideId}` }, (payload: any) => {
        if (payload.new) setRide(payload.new);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_ride_passengers", filter: `ride_id=eq.${rideId}` }, () => {
        supabase.from("group_ride_passengers").select("*").eq("ride_id", rideId).order("seat_index").then(({ data }: any) => setPassengers(data ?? []));
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [rideId]);

  useEffect(() => {
    if (!ride?.departure_deadline) return;
    const tick = () => {
      const diff = new Date(ride.departure_deadline).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [ride?.departure_deadline]);

  // Auto-trigger : 3/3 ou deadline atteint avec >=2
  useEffect(() => {
    if (!ride || ride.status !== "searching") return;
    const seats = ride.seats_taken ?? 0;
    if (seats >= GROUP_MAX_SEATS) {
      supabase.from("group_rides").update({ status: "matched" }).eq("id", rideId).eq("status", "searching");
    } else if (remaining === 0 && seats >= 2) {
      supabase.from("group_rides").update({ status: "matched" }).eq("id", rideId).eq("status", "searching");
    } else if (remaining === 0 && seats < 2) {
      supabase.from("group_rides").update({ status: "cancelled", archived_at: new Date().toISOString() }).eq("id", rideId).eq("status", "searching");
    }
  }, [remaining, ride, rideId]);

  const cancelSeat = async () => {
    if (!user) return;
    setCancelling(true);
    try {
      const me = passengers.find((p) => p.user_id === user.id);
      if (!me) return;
      await supabase.from("group_ride_passengers").update({ status: "cancelled" }).eq("id", me.id);
      await supabase.from("group_rides").update({ seats_taken: Math.max(0, (ride?.seats_taken ?? 1) - 1) }).eq("id", rideId);
      toast.success("Place libérée");
      navigate({ to: "/espace-client" });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!ride) return <div className="p-6 text-center text-sm text-muted-foreground">Course introuvable.</div>;

  const seats = ride.seats_taken ?? 0;
  const remainingSeats = GROUP_MAX_SEATS - seats;
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const totalToPay = ride.price_per_seat ?? 0;
  const statusLabel = GROUP_RIDE_STATUS_LABEL[ride.status] ?? ride.status;
  const isMatched = ride.status === "matched" || ride.status === "driver_arriving" || ride.status === "active";

  const statusTone =
    ride.status === "searching" ? "bg-amber-500/15 text-amber-600 ring-amber-500/30"
    : ride.status === "matched" ? "bg-primary/15 text-primary ring-primary/30"
    : ride.status === "driver_arriving" ? "bg-blue-500/15 text-blue-600 ring-blue-500/30"
    : ride.status === "active" ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30"
    : ride.status === "completed" ? "bg-muted text-foreground ring-border"
    : "bg-destructive/15 text-destructive ring-destructive/30";
  const StatusIcon =
    ride.status === "searching" ? Clock
    : ride.status === "matched" ? CheckCircle2
    : ride.status === "driver_arriving" ? Navigation
    : ride.status === "active" ? Navigation
    : ride.status === "completed" ? CheckCircle2
    : XCircle;
  const activePassengers = passengers.filter((p) => p.status !== "cancelled");

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background pb-32">
      <section className="rounded-b-[28px] bg-gradient-to-br from-primary to-primary/85 px-5 pb-6 pt-7 text-primary-foreground shadow-lg">
        <Link to="/deplacement-groupe" className="inline-flex items-center gap-1 text-[12px] font-semibold opacity-80"><ArrowLeft className="h-3 w-3" /> Retour</Link>
        <h1 className="mt-2 text-xl font-extrabold">Salle d'attente</h1>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-[11px] font-bold ring-1 ring-primary-foreground/25 backdrop-blur">
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </div>
      </section>

      <main className="mx-auto -mt-3 max-w-md space-y-3 px-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl border border-primary/30 bg-card p-5 text-center shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Départ dans</p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums text-foreground">{mm}:{ss}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{seats}/{GROUP_MAX_SEATS} places occupées</p>
        </motion.div>

        <div className={`inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-[12px] font-bold ring-1 ${statusTone}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          Statut en temps réel : {statusLabel}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: GROUP_MAX_SEATS }).map((_, i) => {
            const occupied = i < seats;
            return (
              <motion.div
                key={i}
                animate={{ scale: occupied ? 1 : 0.95, opacity: occupied ? 1 : 0.5 }}
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 ${occupied ? "border-primary/40 bg-primary/10" : "border-dashed border-muted-foreground/30 bg-muted/30"}`}
              >
                <Users className={`h-5 w-5 ${occupied ? "text-primary" : "text-muted-foreground"}`} />
                <span className="mt-1 text-[10.5px] font-bold">Place {i + 1}</span>
              </motion.div>
            );
          })}
        </div>

        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Passagers ({activePassengers.length})</h2>
            <span className="text-[10px] font-semibold text-primary">Temps réel</span>
          </div>
          <ul className="space-y-2">
            {activePassengers.length === 0 && (
              <li className="rounded-xl bg-muted/40 p-3 text-center text-[11.5px] text-muted-foreground">Aucun passager pour le moment…</li>
            )}
            {activePassengers.map((p) => {
              const me = user?.id === p.user_id;
              return (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-2.5 rounded-2xl border p-2.5 ${me ? "border-primary/40 bg-primary/5" : "bg-card"}`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${me ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-bold">Place {p.seat_index}{me ? " · Vous" : ""}</span>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-primary">{p.status}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0 text-primary" /> {p.pickup_address}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <Navigation className="h-3 w-3 shrink-0 text-accent-foreground" /> {p.destination_address}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-muted-foreground">Votre tarif</span>
            <span className="text-xl font-extrabold text-primary">{formatXAF(totalToPay)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {ride.communes_count === 1 ? "Même commune" : ride.communes_count === 2 ? "Entre 2 communes" : "Entre 3 communes"}
            · {remainingSeats > 0 ? `${remainingSeats} place${remainingSeats > 1 ? "s" : ""} restante${remainingSeats > 1 ? "s" : ""}` : "Complet"}
          </p>
        </div>

        {isMatched ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/mes-reservations" })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground shadow-lg active:scale-[0.98]"
          >
            <Wallet className="h-4 w-4" /> Procéder au paiement
          </button>
        ) : ride.status === "cancelled" ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center text-[12.5px] font-semibold text-destructive">
            Pas assez de passagers à temps. Course annulée — aucun débit.
            <div className="mt-2"><Link to="/deplacement-groupe" className="text-primary underline">Réessayer</Link> · <Link to="/vtc" className="text-primary underline">Course privée</Link></div>
          </div>
        ) : (
          <button
            type="button"
            onClick={cancelSeat}
            disabled={cancelling}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border bg-card py-3 text-[13px] font-bold text-foreground hover:bg-muted disabled:opacity-50"
          >
            Annuler ma place
          </button>
        )}
      </main>
      <ClientNav />
    </div>
  );
}
