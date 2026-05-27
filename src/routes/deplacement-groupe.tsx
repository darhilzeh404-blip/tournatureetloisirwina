import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";

const supabase = supabaseTyped as any;
import { VtcDestinationSearch } from "@/components/VtcDestinationSearch";
import { formatXAF } from "@/lib/vtc-zones";
import {
  GROUP_MAX_SEATS,
  GROUP_WAIT_MINUTES,
  POPULAR_STOPS,
  communeLabel,
  communesCount,
  estimateTrip,
  pricePerSeat,
  rideSignature,
  stopFromCoords,
  type GroupStop,
  type PopularStop,
} from "@/lib/group-ride";

export const Route = createFileRoute("/deplacement-groupe")({
  head: () => ({
    meta: [
      { title: "Déplacement Groupé — Agence Wina" },
      { name: "description", content: "Partagez votre trajet avec d'autres passagers à Libreville. Tarifs réduits dès 1500 FCFA." },
    ],
  }),
  component: GroupRidePage,
});

function GroupRidePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [pickup, setPickup] = useState<GroupStop | null>(null);
  const [destination, setDestination] = useState<GroupStop | null>(null);
  const [joining, setJoining] = useState(false);



  const fare = useMemo(() => {
    if (!pickup || !destination) return null;
    const count = communesCount(pickup, destination);
    return { count, perSeat: pricePerSeat(count), signature: rideSignature(pickup, destination) };
  }, [pickup, destination]);

  const estimate = useMemo(() => {
    if (!pickup || !destination) return null;
    return estimateTrip(pickup, destination);
  }, [pickup, destination]);

  const pickStop = (s: PopularStop, target: "pickup" | "destination") => {
    const stop = stopFromCoords(s.lat, s.lng, s.label);
    if (target === "pickup") setPickup(stop);
    else setDestination(stop);
  };

  const ready = !!(pickup?.commune && destination?.commune);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error("Géolocalisation indisponible"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const stop = stopFromCoords(p.coords.latitude, p.coords.longitude, `Ma position (${communeLabel(stopFromCoords(p.coords.latitude, p.coords.longitude, "").commune)})`);
        setPickup(stop);
        if (!stop.commune) toast.warning("Hors zone desservie.");
      },
      () => toast.error("Impossible d'obtenir votre position"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const joinOrCreate = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!pickup || !destination || !fare) {
      toast.error("Sélectionnez le départ et la destination");
      return;
    }
    if (!pickup.commune || !destination.commune) {
      toast.error("Trajet hors zone desservie");
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc("join_group_ride", {
        _signature: fare.signature,
        _communes_count: fare.count,
        _price_per_seat: fare.perSeat,
        _wait_minutes: GROUP_WAIT_MINUTES,
        _max_seats: GROUP_MAX_SEATS,
        _pickup_address: pickup.address,
        _pickup_lat: pickup.lat,
        _pickup_lng: pickup.lng,
        _destination_address: destination.address,
        _destination_lat: destination.lat,
        _destination_lng: destination.lng,
        _commune_pickup: pickup.commune,
        _commune_destination: destination.commune,
      });

      if (error) {
        const msg = String(error.message || "");
        console.error("[group-ride] join error", error);
        if (msg.includes("ALREADY_IN_RIDE")) {
          toast.error("Vous avez déjà une course groupée en cours");
        } else if (msg.includes("NOT_AUTHENTICATED")) {
          toast.error("Session expirée, reconnectez-vous");
          navigate({ to: "/connexion" });
        } else if (msg.includes("ride_full") || msg.includes("full")) {
          toast.error("Ce trajet est complet, essayez un autre horaire.");
        } else {
          toast.error("Impossible de réserver pour le moment. Réessayez.");
        }
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      console.debug("[group-ride] RPC join_group_ride success", row);
      if (!row?.ride_id) {
        console.error("[group-ride] missing ride_id in RPC response", data);
        toast.error("Réponse inattendue du serveur");
        return;
      }

      console.debug("[group-ride] ride_id reçu, redirection vers waiting", row.ride_id);
      toast.success("Place réservée ! Redirection…");
      navigate({
        to: "/deplacement-groupe/waiting/$rideId",
        params: { rideId: row.ride_id },
        replace: true,
      });
    } catch (e: any) {
      console.error("[group-ride] join exception", e);
      toast.error("Erreur réseau, veuillez réessayer");
    } finally {
      setJoining(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background pb-32">
      <section className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-primary via-primary to-primary/85 px-5 pb-6 pt-7 shadow-lg shadow-primary/20">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary-foreground blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-md ring-1 ring-primary-foreground/25">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">Covoiturage urbain</p>
              <h1 className="text-xl font-extrabold leading-tight text-primary-foreground">Déplacement Groupé</h1>
            </div>
          </div>
          <p className="mt-2 max-w-md text-[12.5px] leading-snug text-primary-foreground/85">
            Partagez votre trajet — jusqu'à 3 passagers — et payez moins cher. Tarif fixe selon les communes.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Économique", "Trajet partagé", "Prix réduit"].map((b) => (
              <span key={b} className="rounded-full bg-primary-foreground/20 px-2.5 py-1 text-[10.5px] font-semibold text-primary-foreground ring-1 ring-primary-foreground/25">
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto -mt-3 max-w-3xl space-y-3 px-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-3xl border bg-card p-4 shadow-sm">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-foreground">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">A</span>
              Point de départ
              {pickup?.commune && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{communeLabel(pickup.commune)}</span>}
            </label>
            <VtcDestinationSearch
              placeholder="Adresse de départ…"
              value={pickup?.address ?? ""}
              icon={<Navigation className="h-4 w-4 text-primary" />}
              onSelect={({ lat, lng, label }) => {
                const s = stopFromCoords(lat, lng, label);
                setPickup(s);
                if (!s.commune) toast.warning("Hors zone desservie.");
              }}
              onClear={() => setPickup(null)}
            />
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={useCurrentLocation}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[11px] font-bold hover:bg-primary/5"
              >
                <Navigation className="h-3 w-3 text-primary" /> Ma position
              </button>
            </div>
            <StopChips target="pickup" onPick={pickStop} />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-foreground">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/80 text-[10px] text-accent-foreground">B</span>
              Destination
              {destination?.commune && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{communeLabel(destination.commune)}</span>}
            </label>
            <VtcDestinationSearch
              placeholder="Adresse de destination…"
              value={destination?.address ?? ""}
              icon={<MapPin className="h-4 w-4 text-primary" />}
              onSelect={({ lat, lng, label }) => {
                const s = stopFromCoords(lat, lng, label);
                setDestination(s);
                if (!s.commune) toast.warning("Hors zone desservie.");
              }}
              onClear={() => setDestination(null)}
            />
            <StopChips target="destination" onPick={pickStop} />
          </div>
        </motion.div>

        {estimate && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-2 rounded-3xl border bg-card p-3 shadow-sm"
          >
            <div className="flex items-center gap-2 rounded-2xl bg-secondary/40 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <RouteIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Distance</p>
                <p className="text-base font-extrabold text-foreground">~ {estimate.distanceKm} km</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-secondary/40 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Durée estimée</p>
                <p className="text-base font-extrabold text-foreground">~ {estimate.durationMin} min</p>
              </div>
            </div>
          </motion.div>
        )}

        {fare && (
          <motion.div
            layout
            className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.4)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Votre place</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {fare.count === 1 ? "Même commune" : fare.count === 2 ? "Entre 2 communes" : "Entre 3 communes"}
                </p>
              </div>
              <p className="text-2xl font-extrabold text-primary">{formatXAF(fare.perSeat)}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" />
              Tarif fixe par passager · 3 places max · Départ garanti à partir de 2 passagers
            </div>
          </motion.div>
        )}

        <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-3 text-[11.5px] text-foreground/80">
          <strong>Comment ça marche :</strong> nous cherchons jusqu'à 2 autres passagers allant dans la même direction.
          Si 3 places sont prises avant {GROUP_WAIT_MINUTES} min, le départ est immédiat. Sinon, départ garanti dès 2 passagers à la fin du décompte.
        </div>

        <button
          type="button"
          disabled={!ready || joining}
          onClick={joinOrCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground shadow-[0_12px_30px_-10px_hsl(var(--primary)/0.55)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          {joining ? "Recherche…" : ready ? "Trouver un groupe et réserver" : "Sélectionnez départ & destination"}
        </button>

        <button
          type="button"
          onClick={async () => {
            if (!user) { navigate({ to: "/connexion" }); return; }
            const { data, error } = await supabase
              .from("group_ride_passengers")
              .select("ride_id, group_rides!inner(status, archived_at)")
              .eq("user_id", user.id)
              .neq("status", "cancelled")
              .order("joined_at", { ascending: false })
              .limit(5);
            if (error) { console.error(error); toast.error("Erreur de chargement"); return; }
            const activeStatuses = ["searching", "matched", "driver_arriving", "active"];
            const active = (data ?? []).find((row: any) => {
              const r = row.group_rides;
              return r && r.archived_at === null && activeStatuses.includes(r.status);
            });
            if (active?.ride_id) {
              navigate({ to: "/deplacement-groupe/waiting/$rideId", params: { rideId: active.ride_id } });
              return;
            }
            const lastCompleted = (data ?? []).find((row: any) => row.group_rides?.status === "completed");
            if (lastCompleted) { navigate({ to: "/mes-reservations" }); return; }
            toast.info("Aucune course groupée active");
          }}
          className="flex w-full items-center justify-center gap-1 pt-2 text-[12px] font-semibold text-primary"
        >
          Voir mes courses groupées <ArrowRight className="h-3 w-3" />
        </button>
      </main>

      <ClientNav />
    </div>
  );
}

function StopChips({
  target,
  onPick,
}: {
  target: "pickup" | "destination";
  onPick: (s: PopularStop, target: "pickup" | "destination") => void;
}) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Arrêts populaires
      </p>
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_STOPS.map((s) => (
          <button
            key={`${target}-${s.label}`}
            type="button"
            onClick={() => onPick(s, target)}
            className="inline-flex items-center gap-1 rounded-full border bg-secondary/40 px-2.5 py-1 text-[10.5px] font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <MapPin className="h-3 w-3 text-primary" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
