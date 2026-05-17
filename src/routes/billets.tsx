import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket, ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/billets")({
  head: () => ({
    meta: [
      { title: "Billets — Agence Wina" },
      { name: "description", content: "Achetez vos billets personnalisés (transport, événements, activités) au Gabon." },
    ],
  }),
  component: BilletsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

type DbTicket = {
  id: string;
  title: string;
  price: number;
  description: string;
  images: string[];
};

function BilletsPage() {
  const [list, setList] = useState<DbTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tickets" as any)
      .select("id, title, price, description, images")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setList(((data as any) ?? []) as DbTicket[]);
        setLoading(false);
      });
  }, []);

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
            <p className="text-sm text-muted-foreground">Tickets personnalisés disponibles</p>
          </div>
        </header>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : list.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun billet disponible pour le moment.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {list.map((t) => (
              <Link
                key={t.id}
                to="/billets/$id"
                params={{ id: t.id }}
                className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md"
              >
                {t.images?.[0] && (
                  <div className="h-36 w-full overflow-hidden bg-muted">
                    <img src={t.images[0]} alt={t.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  </div>
                )}
                <div className="p-4">
                  <h2 className="text-base font-bold">{t.title}</h2>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-primary">{fmt(t.price)}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                      Acheter <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
