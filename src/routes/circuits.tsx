import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, ArrowRight, Calendar, Users, Loader2 } from "lucide-react";
import { fetchOffersByType, type Offer } from "@/server/fetch-offers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import circuitsImg from "@/assets/circuits-hero.jpg";

type Circuit = { id: string; nom: string; description: string };

export const Route = createFileRoute("/circuits")({
  head: () => ({
    meta: [
      { title: "Circuits Touristiques — Agence Wina" },
      { name: "description", content: "Explorez le Gabon : parcs nationaux, plages paradisiaques, chutes et réserves naturelles." },
      { property: "og:title", content: "Circuits Touristiques — Agence Wina" },
      { property: "og:description", content: "Circuits et excursions touristiques au Gabon." },
    ],
  }),
  loader: () => fetchOffersByType({ data: "CIRCUIT_TOURISTIQUE" }),
  component: CircuitsPage,
});

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function CircuitsPage() {
  const offers = Route.useLoaderData();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [open, setOpen] = useState<{ id: string | null; name: string; price: number; type: "offer" | "circuit" } | null>(null);
  const [persons, setPersons] = useState(1);
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("circuits").select("id, nom, description").order("created_at", { ascending: false })
      .then(({ data }) => setCircuits((data as Circuit[]) ?? []));
  }, []);

  const total = open ? open.price * persons : 0;

  const submit = async () => {
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
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "CIRCUIT_TOURISTIQUE" as const,
        reservation_date: date,
        total_amount: total,
        paid_amount: 0,
        details: open.type === "circuit" && open.id
          ? { circuit_id: open.id, circuit: open.name, persons }
          : { offer_id: open.id, circuit: open.name, persons },
      });
      if (error) throw error;
      toast.success("Réservation créée 🎉");
      setOpen(null);
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="relative h-48 overflow-hidden lg:h-64">
        <img src={circuitsImg} alt="Circuits touristiques" className="h-full w-full object-cover" width={1280} height={720} />
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground lg:text-3xl">Circuits Touristiques</h1>
                <p className="text-sm text-primary-foreground/80">Découvrez les merveilles du Gabon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8 space-y-10">
        {/* Offres premium */}
        {offers.length > 0 && (
          <div>
            <h2 className="mb-4 text-lg font-bold">Nos offres</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer: Offer) => (
                <div key={offer.id} className="card-hover overflow-hidden rounded-2xl border bg-card">
                  {offer.image_url && <img src={offer.image_url} alt={offer.title} className="h-40 w-full object-cover" />}
                  <div className="flex items-center gap-3 border-b p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Globe className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-card-foreground">{offer.title}</h3>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-muted-foreground line-clamp-2">{offer.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground">À partir de</span>
                        <p className="text-lg font-bold text-foreground">{formatXAF(offer.price)}</p>
                      </div>
                      <button
                        onClick={() => setOpen({ id: offer.id, name: offer.title, price: offer.price, type: "offer" })}
                        className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Réserver <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Circuits dynamiques (table circuits) */}
        {circuits.length > 0 && (
          <div>
            <h2 className="mb-4 text-lg font-bold">Tous les circuits</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {circuits.map((c) => (
                <article key={c.id} className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <h3 className="font-bold">{c.nom}</h3>
                  </div>
                  {c.description && <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>}
                  <button
                    onClick={() => setOpen({ id: c.id, name: c.nom, price: 0, type: "circuit" })}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Réserver <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {!offers.length && !circuits.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun circuit disponible pour le moment.</p>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Paiement de 50% requis à la réservation. Réservation min. 48h à l'avance.
        </p>
      </section>

      {/* Booking modal */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{open.name}</h3>
                <p className="text-xs text-muted-foreground">Circuit touristique</p>
              </div>
              <button onClick={() => setOpen(null)} className="rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70">
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
                  <button onClick={() => setPersons(Math.max(1, persons - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-lg font-bold">−</button>
                  <span className="min-w-[2.5rem] text-center text-base font-bold">{persons}</span>
                  <button onClick={() => setPersons(persons + 1)} className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-lg font-bold">+</button>
                </div>
              </div>

              {open.price > 0 && (
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-extrabold text-primary">{formatXAF(total)}</p>
                </div>
              )}

              <button
                disabled={submitting}
                onClick={submit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Réservation..." : "Confirmer la réservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
