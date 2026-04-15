import { createFileRoute } from "@tanstack/react-router";
import { Bus, ArrowRight, Loader2 } from "lucide-react";
import { useOffers } from "@/hooks/use-offers";
import busImg from "@/assets/location-bus.jpg";

export const Route = createFileRoute("/location-bus")({
  head: () => ({
    meta: [
      { title: "Location de Bus — Agence Wina" },
      { name: "description", content: "Louez un bus de 14 à 32 places pour vos événements au Gabon. Standard ou VIP." },
      { property: "og:title", content: "Location de Bus — Agence Wina" },
      { property: "og:description", content: "Location de bus événementiel au Gabon." },
    ],
  }),
  component: LocationBusPage,
});

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function LocationBusPage() {
  const { data: offers, isLoading, error } = useOffers("LOCATION_BUS");

  return (
    <>
      <section className="relative h-48 overflow-hidden lg:h-64">
        <img src={busImg} alt="Location de bus" className="h-full w-full object-cover" width={1280} height={720} />
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                <Bus className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground lg:text-3xl">Location de Bus</h1>
                <p className="text-sm text-primary-foreground/80">Pour tous vos événements</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">Erreur lors du chargement des offres.</p>
        ) : !offers?.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune offre de location disponible pour le moment.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <div key={offer.id} className="card-hover overflow-hidden rounded-2xl border bg-card">
                {offer.image_url && (
                  <img src={offer.image_url} alt={offer.title} className="h-40 w-full object-cover" />
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <Bus className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-card-foreground">{offer.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{offer.description}</p>
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

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Paiement de 50% requis à la réservation. Réservation min. 48h à l'avance.
        </p>
      </section>
    </>
  );
}
