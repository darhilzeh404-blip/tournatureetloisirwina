import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, ArrowRight, CarFront, Navigation } from "lucide-react";
import { fetchOffersByType, type Offer } from "@/server/fetch-offers";
import { supabase } from "@/integrations/supabase/client";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";
import { formatFCFA } from "@/lib/destinations";
import circuitsImg from "@/assets/circuits-hero.jpg";

type Circuit = {
  id: string;
  slug: string;
  nom: string;
  description: string;
  base_price: number;
  image_url: string | null;
};

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

function CircuitsPage() {
  const offers = Route.useLoaderData();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [target, setTarget] = useState<BookingTarget | null>(null);

  const vtcHref = (destination: string, source: string) => {
    const params = new URLSearchParams({
      pickup: "Mon hôtel",
      destination: `Point de départ — ${destination}`,
      scheduled_at: nextMorningAtEight(),
      source,
    });
    return `/vtc?${params.toString()}`;
  };

  const gpsSlug = (value: string) => value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  useEffect(() => {
    supabase
      .from("circuits")
      .select("id, slug, nom, description, base_price, image_url")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCircuits((data as Circuit[]) ?? []));
  }, []);

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
                        <p className="text-lg font-bold text-foreground">{formatFCFA(offer.price)}</p>
                      </div>
                      <button
                        onClick={() => setTarget({ kind: "circuit", id: null, name: offer.title, basePrice: offer.price })}
                        className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Réserver <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                    <a
                      href={vtcHref(offer.title, "circuit")}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                    >
                      <CarFront className="h-4 w-4" /> Ajouter un transfert VTC depuis mon hôtel
                    </a>
                    <Link
                      to="/circuits/suivi/$slug"
                      params={{ slug: gpsSlug(offer.title) }}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
                    >
                      <Navigation className="h-4 w-4 text-primary" /> Naviguer vers le circuit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {circuits.length > 0 && (
          <div>
            <h2 className="mb-4 text-lg font-bold">Tous les circuits</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {circuits.map((c) => (
                <article key={c.id} className="card-hover overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.nom} className="h-44 w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <Globe className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <h3 className="font-bold">{c.nom}</h3>
                    </div>
                    {c.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <span className="text-[11px] text-muted-foreground">À partir de</span>
                        <p className="text-base font-extrabold text-primary">{formatFCFA(c.base_price)}</p>
                      </div>
                      <button
                        onClick={() => setTarget({ kind: "circuit", id: c.id, slug: c.slug, name: c.nom, basePrice: c.base_price })}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Réserver <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                    <a
                      href={vtcHref(c.nom, "circuit")}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                    >
                      <CarFront className="h-4 w-4" /> Ajouter un transfert VTC depuis mon hôtel
                    </a>
                    <Link
                      to="/circuits/suivi/$slug"
                      params={{ slug: gpsSlug(c.slug || c.nom) }}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
                    >
                      <Navigation className="h-4 w-4 text-primary" /> Naviguer vers le circuit
                    </Link>
                  </div>
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

      {target && <BookingDialog target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

function nextMorningAtEight() {
  const date = new Date(Date.now() + 48 * 3600 * 1000);
  date.setHours(8, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
