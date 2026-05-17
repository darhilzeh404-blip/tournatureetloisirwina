import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket, Bus, PartyPopper, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/billets")({
  head: () => ({
    meta: [
      { title: "Billets — Agence Wina" },
      { name: "description", content: "Achetez vos tickets de transport et d'événements au Gabon." },
    ],
  }),
  component: BilletsPage,
});

function BilletsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Billets</h1>
            <p className="text-sm text-muted-foreground">Tickets transport & événements</p>
          </div>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/transport-public"
            className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bus className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-bold">Tickets de transport</h2>
            <p className="mt-1 text-sm text-muted-foreground">Bus & trajets planifiés au Gabon.</p>
          </Link>
          <Link
            to="/activites"
            className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground">
              <PartyPopper className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-bold">Tickets d'événements</h2>
            <p className="mt-1 text-sm text-muted-foreground">Concerts, festivals, activités touristiques.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
