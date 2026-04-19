import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Palmtree, Compass, Calendar, Users } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/destinations";

export const Route = createFileRoute("/activites")({
  head: () => ({
    meta: [
      { title: "Activités & Circuits — Agence Wina" },
      {
        name: "description",
        content: "Activités et circuits touristiques au Gabon proposés par notre équipe.",
      },
    ],
  }),
  component: ActivitesPage,
});

type Activity = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_hours: number;
};

type Circuit = {
  id: string;
  nom: string;
  description: string;
};

function ActivitesPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Booking modal state (lightweight inline form)
  const [open, setOpen] = useState<{
    type: "activity" | "circuit";
    id: string;
    name: string;
    price: number;
  } | null>(null);
  const [persons, setPersons] = useState(1);
  const [date, setDate] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: acts }, { data: circs }] = await Promise.all([
        supabase
          .from("transport_activities")
          .select("id, name, description, price, duration_hours")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("circuits").select("id, nom, description").order("created_at", { ascending: false }),
      ]);
      if (!mounted) return;
      setActivities((acts as Activity[]) ?? []);
      setCircuits((circs as Circuit[]) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const totalForOpen = open ? open.price * persons : 0;

  const submitBooking = async () => {
    if (!open) return;
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!date) {
      toast.error("Choisissez une date");
      return;
    }
    setSubmitting(open.id);
    try {
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "CIRCUIT_TOURISTIQUE" as const,
        reservation_date: date,
        total_amount: totalForOpen,
        paid_amount: 0,
        details:
          open.type === "circuit"
            ? { circuit_id: open.id, circuit: open.name, persons }
            : { activity_id: open.id, activity: open.name, persons },
      });
      if (error) throw error;
      toast.success("Réservation créée 🎉");
      setOpen(null);
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="pb-24">
      <div className="warm-gradient px-5 pb-6 pt-8">
        <h1 className="text-xl font-bold text-accent-foreground">🌴 Activités & Circuits</h1>
        <p className="mt-1 text-sm text-accent-foreground/70">
          Découvrez nos expériences au Gabon
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8 px-5 pt-6">
          {/* Circuits */}
          {circuits.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Compass className="h-4 w-4 text-primary" /> Circuits touristiques
              </h2>
              <div className="space-y-3">
                {circuits.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <h3 className="text-base font-bold">{c.nom}</h3>
                    {c.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setOpen({ type: "circuit", id: c.id, name: c.nom, price: 0 })
                      }
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Réserver ce circuit <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Activities */}
          {activities.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Palmtree className="h-4 w-4 text-accent" /> Activités
              </h2>
              <div className="space-y-3">
                {activities.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold">{a.name}</h3>
                        {a.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-extrabold text-primary">
                          {formatFCFA(a.price)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">/personne</p>
                      </div>
                    </div>
                    {a.duration_hours > 0 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        ⏱ {a.duration_hours}h
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setOpen({ type: "activity", id: a.id, name: a.name, price: a.price })
                      }
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:bg-accent/90"
                    >
                      Réserver l'activité <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {circuits.length === 0 && activities.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-muted/40 p-8 text-center">
              <Palmtree className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                Aucune activité ni circuit disponible pour l'instant.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Revenez bientôt — notre équipe ajoute régulièrement de nouvelles offres.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Booking dialog */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{open.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {open.type === "circuit" ? "Circuit touristique" : "Activité"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
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
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-4 w-4 text-primary" /> Personnes
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPersons(Math.max(1, persons - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="min-w-[2.5rem] text-center text-base font-bold">{persons}</span>
                  <button
                    type="button"
                    onClick={() => setPersons(persons + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {open.price > 0 && (
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-extrabold text-primary">{formatFCFA(totalForOpen)}</p>
                </div>
              )}

              <button
                type="button"
                disabled={submitting !== null}
                onClick={submitBooking}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {submitting ? "Réservation..." : "Confirmer la réservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ClientNav />
    </div>
  );
}
