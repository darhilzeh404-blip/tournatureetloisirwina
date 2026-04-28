import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Palmtree, Compass, Navigation } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/destinations";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";

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
  slug: string;
  nom: string;
  description: string;
  base_price: number;
  image_url: string | null;
};

function ActivitesPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<BookingTarget | null>(null);

  const openCircuitNavigation = (slug: string) => {
    navigate({ to: "/circuits/suivi/$slug", params: { slug } });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: acts }, { data: circs }] = await Promise.all([
        supabase
          .from("transport_activities")
          .select("id, name, description, price, duration_hours")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("circuits")
          .select("id, slug, nom, description, base_price, image_url")
          .eq("is_active", true)
          .order("sort_order"),
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

  return (
    <div className="pb-24">
      <div className="warm-gradient px-5 pb-6 pt-8">
        <h1 className="text-xl font-bold text-accent-foreground">🌴 Activités & Circuits</h1>
        <p className="mt-1 text-sm text-accent-foreground/70">Découvrez nos expériences au Gabon</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8 px-5 pt-6">
          {circuits.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Compass className="h-4 w-4 text-primary" /> Circuits touristiques
              </h2>
              <div className="space-y-3">
                {circuits.map((c) => (
                  <article
                    key={c.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Naviguer vers le circuit ${c.nom}`}
                    onClick={(event) => {
                      if (isInteractiveTarget(event.target)) return;
                      openCircuitNavigation(c.slug || gpsSlug(c.nom));
                    }}
                    onKeyDown={(event) => {
                      if (isInteractiveTarget(event.target)) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCircuitNavigation(c.slug || gpsSlug(c.nom));
                      }
                    }}
                    className="cursor-pointer rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base font-bold">{c.nom}</h3>
                        {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-extrabold text-primary">{formatFCFA(c.base_price)}</p>
                        <p className="text-[10px] text-muted-foreground">/personne</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          setTarget({
                            kind: "circuit",
                            id: c.id,
                            slug: c.slug,
                            name: c.nom,
                            basePrice: c.base_price,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        Réserver ce circuit <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        to="/circuits/suivi/$slug"
                        params={{ slug: c.slug || gpsSlug(c.nom) }}
                        aria-label={`Naviguer vers le circuit ${c.nom}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-bold leading-tight text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Navigation className="h-4 w-4 shrink-0 text-primary" />
                        <span>Naviguer vers le circuit</span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activities.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Palmtree className="h-4 w-4 text-accent" /> Activités
              </h2>
              <div className="space-y-3">
                {activities.map((a) => (
                  <article key={a.id} className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold">{a.name}</h3>
                        {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-extrabold text-primary">{formatFCFA(a.price)}</p>
                        <p className="text-[10px] text-muted-foreground">/personne</p>
                      </div>
                    </div>
                    {a.duration_hours > 0 && <p className="mt-2 text-[11px] text-muted-foreground">⏱ {a.duration_hours}h</p>}
                    <button
                      type="button"
                      onClick={() =>
                        setTarget({
                          kind: "activity",
                          id: a.id,
                          name: a.name,
                          basePrice: a.price,
                        })
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
              <p className="mt-3 text-sm font-medium text-muted-foreground">Aucune activité ni circuit disponible.</p>
            </div>
          )}
        </div>
      )}

      {target && <BookingDialog target={target} onClose={() => setTarget(null)} />}
      <ClientNav />
    </div>
  );
}

function gpsSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
