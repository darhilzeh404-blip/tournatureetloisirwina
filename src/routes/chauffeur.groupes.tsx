import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Users, MapPin, Loader2, CheckCircle2, Play, Flag, RefreshCw, Car } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GROUP_RIDE_STATUS_LABEL } from "@/lib/group-ride";

export const Route = createFileRoute("/chauffeur/groupes")({
  head: () => ({ meta: [{ title: "Courses Groupées — Chauffeur" }] }),
  component: ChauffeurGroupesPage,
});

interface GroupRide {
  id: string;
  status: string;
  seats_taken: number;
  max_seats: number;
  price_per_seat: number;
  communes_count: number;
  departure_deadline: string;
  driver_id: string | null;
  signature: string | null;
  created_at: string;
}

interface Passenger {
  id: string;
  ride_id: string;
  user_id: string;
  pickup_address: string;
  destination_address: string;
  commune_pickup: string;
  commune_destination: string;
  status: string;
}

const NEXT_STATUS: Record<string, { next: string; label: string; icon: typeof Play }> = {
  matched: { next: "driver_arriving", label: "Je suis en route", icon: Car },
  driver_arriving: { next: "active", label: "Démarrer la course", icon: Play },
  active: { next: "completed", label: "Terminer la course", icon: Flag },
};

function ChauffeurGroupesPage() {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();
  const [pool, setPool] = useState<GroupRide[]>([]);
  const [mine, setMine] = useState<GroupRide[]>([]);
  const [passengers, setPassengers] = useState<Record<string, Passenger[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || (role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, user, role, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Deux requêtes parallèles pour contourner les limites de PostgREST
    // (le parsing de `or(and(...,in.(...)))` casse les filtres composés).
    const [mineRes, poolRes] = await Promise.all([
      supabase
        .from("group_rides")
        .select("*")
        .eq("driver_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("group_rides")
        .select("*")
        .is("driver_id", null)
        .is("archived_at", null)
        .in("status", ["searching", "matched"])
        .order("created_at", { ascending: false }),
    ]);

    if (mineRes.error || poolRes.error) {
      console.error("[chauffeur.groupes] load error", mineRes.error || poolRes.error);
      toast.error("Erreur de chargement");
      setLoading(false);
      return;
    }
    const mineRows = (mineRes.data || []) as GroupRide[];
    const poolRows = (poolRes.data || []) as GroupRide[];
    setMine(mineRows);
    setPool(poolRows);
    const rows = [...mineRows, ...poolRows];


    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      const { data: pax } = await supabase
        .from("group_ride_passengers")
        .select("id, ride_id, user_id, pickup_address, destination_address, commune_pickup, commune_destination, status")
        .in("ride_id", ids)
        .neq("status", "cancelled");
      const map: Record<string, Passenger[]> = {};
      ((pax || []) as Passenger[]).forEach((p) => {
        (map[p.ride_id] ||= []).push(p);
      });
      setPassengers(map);
    } else {
      setPassengers({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void load();
    const ch = supabase
      .channel(`chauffeur-groupes-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_rides" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_ride_passengers" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const acceptRide = async (ride: GroupRide) => {
    if (!user) return;
    setBusyId(ride.id);
    const { error } = await supabase
      .from("group_rides")
      .update({ driver_id: user.id, status: "driver_arriving" })
      .eq("id", ride.id)
      .is("driver_id", null);
    setBusyId(null);
    if (error) {
      toast.error("Course déjà prise ou erreur");
    } else {
      toast.success("Course acceptée");
      void load();
    }
  };

  const advance = async (ride: GroupRide) => {
    const step = NEXT_STATUS[ride.status];
    if (!step) return;
    setBusyId(ride.id);
    const now = new Date().toISOString();
    const patch = {
      status: step.next,
      ...(step.next === "active" ? { started_at: now } : {}),
      ...(step.next === "completed" ? { completed_at: now, archived_at: now } : {}),
    };
    const { error } = await supabase.from("group_rides").update(patch).eq("id", ride.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else {
      toast.success(GROUP_RIDE_STATUS_LABEL[step.next] || "Statut mis à jour");
      void load();
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Chargement…</div>;
  if (!user || (role !== "chauffeur" && role !== "admin")) return null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Link to="/chauffeur"><Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold">Courses Groupées</h1>
            <p className="text-xs text-muted-foreground">Covoiturage Libreville · {mine.length} en cours · {pool.length} disponibles</p>
          </div>
          <Button size="icon" variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
          </Button>
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Mes courses</h2>
          {mine.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Aucune course assignée</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {mine.map((r) => (
                <RideCard key={r.id} ride={r} passengers={passengers[r.id] || []} busy={busyId === r.id} onAdvance={() => advance(r)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Courses disponibles</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : pool.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Aucune course en attente d'un chauffeur</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {pool.map((r) => (
                <RideCard
                  key={r.id}
                  ride={r}
                  passengers={passengers[r.id] || []}
                  busy={busyId === r.id}
                  onAccept={() => acceptRide(r)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function RideCard({
  ride,
  passengers,
  busy,
  onAccept,
  onAdvance,
}: {
  ride: GroupRide;
  passengers: Passenger[];
  busy: boolean;
  onAccept?: () => void;
  onAdvance?: () => void;
}) {
  const step = NEXT_STATUS[ride.status];
  const StepIcon = step?.icon;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge variant="secondary">{GROUP_RIDE_STATUS_LABEL[ride.status] || ride.status}</Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              {ride.communes_count} commune(s) · {ride.price_per_seat} XAF / place
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
            <Users className="h-4 w-4" /> {ride.seats_taken}/{ride.max_seats}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          {passengers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun passager</p>
          ) : (
            passengers.map((p, i) => (
              <div key={p.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 text-green-600" /> {p.pickup_address}</p>
                  <p className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 text-red-600" /> {p.destination_address}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {onAccept && (
          <Button onClick={onAccept} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            Accepter cette course
          </Button>
        )}
        {onAdvance && step && StepIcon && (
          <Button onClick={onAdvance} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <StepIcon className="mr-1 h-4 w-4" />}
            {step.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
