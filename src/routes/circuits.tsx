import { createFileRoute } from "@tanstack/react-router";
import { Globe, MapPin, ArrowRight, Loader2 } from "lucide-react";
import { useOffers } from "@/hooks/use-offers";
import circuitsImg from "@/assets/circuits-hero.jpg";

export const Route = createFileRoute("/circuits")({
  head: () => ({
    meta: [
      { title: "Circuits Touristiques — Agence Wina" },
      { name: "description", content: "Explorez le Gabon : parcs nationaux, plages paradisiaques, chutes et réserves naturelles." },
      { property: "og:title", content: "Circuits Touristiques — Agence Wina" },
      { property: "og:description", content: "Circuits et excursions touristiques au Gabon." },
    ],
  }),
  component: CircuitsPage,
});

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function CircuitsPage() {
  const { data: offers, isLoading, error } = useOffers("CIRCUIT_TOURISTIQUE");

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

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">Erreur lors du chargement des circuits.</p>
        ) : !offers?.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun circuit disponible pour le moment.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <div key={offer.id} className="card-hover overflow-hidden rounded-2xl border bg-card">
                {offer.image_url && (
                  <img src={offer.image_url} alt={offer.title} className="h-40 w-full object-cover" />
                )}
                <div className="flex items-center gap-3 border-b p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-card-foreground">{offer.title}</h3>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-muted-foreground line-clamp-2">{offer.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">À partir de</span>
                      <p className="text-lg font-bold text-foreground">{formatXAF(offer.price)}</p>
                    </div>
                    <button className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                      Réserver <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Paiement de 50% requis à la réservation. Réservation min. 48h à l'avance.
        </p>
      </section>
    </>
  );
}
