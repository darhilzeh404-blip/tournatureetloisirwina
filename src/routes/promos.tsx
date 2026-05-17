import { createFileRoute, Link } from "@tanstack/react-router";
import { Tag, ArrowLeft } from "lucide-react";
import { useOffers } from "@/hooks/use-offers";

export const Route = createFileRoute("/promos")({
  head: () => ({
    meta: [
      { title: "Promos — Agence Wina" },
      { name: "description", content: "Offres et promotions en cours sur le transport et les circuits." },
    ],
  }),
  component: PromosPage,
});

function PromosPage() {
  const { data: offers, isLoading } = useOffers();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Tag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Promos en cours</h1>
            <p className="text-sm text-muted-foreground">Profitez de nos offres du moment</p>
          </div>
        </header>

        <div className="mt-8 grid gap-3">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && (!offers || offers.length === 0) && (
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucune promotion active pour le moment. Revenez bientôt !
            </div>
          )}
          {offers?.map((o) => (
            <article key={o.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold">{o.title}</h2>
                {o.discount_percentage != null && (
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                    -{o.discount_percentage}%
                  </span>
                )}
              </div>
              {o.description && <p className="mt-2 text-sm text-muted-foreground">{o.description}</p>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
