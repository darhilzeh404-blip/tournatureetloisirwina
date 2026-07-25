import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TicketCategoryIcon, CATEGORY_LABELS, type TicketCategorySlug } from "@/components/TicketCategoryIcon";
import { AgencyLogo } from "@/components/AgencyLogo";

export const Route = createFileRoute("/billets/categorie/$slug")({
  component: CategoryPage,
});

type AgencyRow = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  is_verified: boolean;
};

function CategoryPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [categoryName, setCategoryName] = useState<string>("");
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug === "avion") {
      navigate({ to: "/vols" });
    }
  }, [slug, navigate]);


  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cat } = await supabase
        .from("ticket_categories" as any)
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();
      if (cat) setCategoryName((cat as any).name);

      const catId = (cat as any)?.id ?? null;

      // Try public view first; fallback to base table
      let agenciesData: any[] | null = null;
      const pubRes = await supabase
        .from("partner_agencies_public" as any)
        .select("id, name, logo_url, description, category, is_verified")
        .eq("category", slug)
        .order("is_verified", { ascending: false });
      if (!pubRes.error && pubRes.data) {
        agenciesData = pubRes.data as any[];
      } else {
        const fbRes = await supabase
          .from("partner_agencies" as any)
          .select("id, name, logo_url, description, category, is_verified, is_active")
          .eq("category", slug)
          .eq("is_active", true)
          .order("is_verified", { ascending: false });
        agenciesData = (fbRes.data as any[]) ?? [];
      }

      const list = (agenciesData ?? []) as AgencyRow[];
      setAgencies(list);

      if (catId && list.length > 0) {
        const { data: tks } = await supabase
          .from("partner_tickets" as any)
          .select("agency_id")
          .eq("category_id", catId)
          .eq("is_active", true);
        const counts: Record<string, number> = {};
        ((tks as any[]) ?? []).forEach((t) => {
          counts[t.agency_id] = (counts[t.agency_id] ?? 0) + 1;
        });
        setTicketCounts(counts);
      }
      setLoading(false);
    })();
  }, [slug]);

  const label = CATEGORY_LABELS[slug as TicketCategorySlug] ?? categoryName;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Toutes les catégories
        </Link>

        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TicketCategoryIcon slug={slug} className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{label}</h1>
            <p className="text-sm text-muted-foreground">
              {agencies.length} agence{agencies.length > 1 ? "s" : ""} partenaire{agencies.length > 1 ? "s" : ""}
            </p>
          </div>
        </header>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : agencies.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucune agence partenaire dans cette catégorie pour le moment.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {agencies.map((a) => {
              const count = ticketCounts[a.id] ?? 0;
              return (
                <Link
                  key={a.id}
                  to="/billets/agence/$agencyId"
                  params={{ agencyId: a.id }}
                  className="group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
                >
                  {a.logo_url ? (
                    <AgencyLogo src={a.logo_url} alt={a.name} size={56} />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <TicketCategoryIcon slug={slug} className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-base font-bold">{a.name}</p>
                      {a.is_verified && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                          <BadgeCheck className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{a.description}</p>
                    )}
                    <p className="mt-1 text-[11px] font-semibold text-primary">
                      {count} billet{count > 1 ? "s" : ""} disponible{count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
