import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket, Bus, PartyPopper, ArrowLeft, ArrowRight, MapPin, Calendar } from "lucide-react";
import { TICKETS, type TicketKind } from "@/lib/tickets-catalog";
import { useState } from "react";

export const Route = createFileRoute("/billets")({
  head: () => ({
    meta: [
      { title: "Billets — Agence Wina" },
      { name: "description", content: "Achetez vos tickets de transport et d'événements au Gabon." },
    ],
  }),
  component: BilletsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

function BilletsPage() {
  const [tab, setTab] = useState<TicketKind | "all">("all");
  const list = TICKETS.filter(t => tab === "all" || t.kind === tab);

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

        <div className="mt-6 inline-flex rounded-2xl border bg-card p-1">
          {([
            { k: "all", label: "Tous" },
            { k: "transport", label: "Transport" },
            { k: "event", label: "Événements" },
          ] as const).map(o => (
            <button
              key={o.k}
              onClick={() => setTab(o.k)}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors ${
                tab === o.k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {list.map(t => {
            const Icon = t.kind === "transport" ? Bus : PartyPopper;
            return (
              <Link
                key={t.id}
                to="/billets/$id"
                params={{ id: t.id }}
                className="group flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    t.kind === "transport" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent-foreground"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.kind === "transport" ? "Transport" : "Événement"}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-bold">{t.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                  {t.date && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{t.date}</div>}
                  {t.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{t.location}</div>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-primary">{fmt(t.price)}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                    Acheter <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
