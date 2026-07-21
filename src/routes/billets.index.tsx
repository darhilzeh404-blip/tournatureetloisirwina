import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TicketCategoryIcon, CATEGORY_LABELS, type TicketCategorySlug } from "@/components/TicketCategoryIcon";

export const Route = createFileRoute("/billets/")({
  head: () => ({
    meta: [
      { title: "Billets — Agence Wina" },
      { name: "description", content: "Achetez vos billets de bus, train, avion, bateau et événements au Gabon." },
    ],
  }),
  component: BilletsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

type Category = { id: string; slug: string; name: string; sort_order: number };
type WinaTicket = { id: string; title: string; price: number; description: string; images: string[] };

function BilletsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [wina, setWina] = useState<WinaTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase
        .from("ticket_categories" as any)
        .select("id, slug, name, sort_order")
        .order("sort_order");
      const list = (cats as any as Category[]) ?? [];
      setCategories(list);

      // Count active tickets per category
      const results = await Promise.all(
        list.map((c) =>
          supabase
            .from("partner_tickets" as any)
            .select("id", { count: "exact", head: true })
            .eq("category_id", c.id)
            .eq("is_active", true)
        )
      );
      const map: Record<string, number> = {};
      list.forEach((c, i) => { map[c.slug] = results[i].count ?? 0; });
      setCounts(map);

      const { data: winaList } = await supabase
        .from("tickets" as any)
        .select("id, title, price, description, images")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at", { ascending: false });
      setWina(((winaList as any) ?? []) as WinaTicket[]);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Billets</h1>
            <p className="text-sm text-muted-foreground">Choisissez votre type de billet</p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/billets/categorie/$slug"
              params={{ slug: c.slug }}
              className="group flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <TicketCategoryIcon slug={c.slug} className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-bold">{CATEGORY_LABELS[c.slug as TicketCategorySlug] ?? c.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {(counts[c.slug] ?? 0)} billet{(counts[c.slug] ?? 0) > 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold">Billets Wina</h2>
          <p className="text-xs text-muted-foreground">Tickets personnalisés Wina</p>
          {loading ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : wina.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Aucun billet Wina pour le moment.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {wina.map((t) => (
                <Link
                  key={t.id}
                  to="/billets/$id"
                  params={{ id: t.id }}
                  className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md"
                >
                  {t.images?.[0] && (
                    <div className="h-32 w-full overflow-hidden bg-muted">
                      <img src={t.images[0]} alt={t.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-base font-bold">{t.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-primary">{fmt(t.price)}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        Voir <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
