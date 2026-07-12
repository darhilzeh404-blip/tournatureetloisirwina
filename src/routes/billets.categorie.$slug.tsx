import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, MapPin, Users, Minus, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TicketCategoryIcon, CATEGORY_LABELS, type TicketCategorySlug } from "@/components/TicketCategoryIcon";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/billets/categorie/$slug")({
  component: CategoryPage,
});


const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

type Ticket = {
  id: string;
  title: string;
  origin: string | null;
  destination: string | null;
  departure_at: string | null;
  price: number;
  seats_available: number;
  description: string;
  image_url: string | null;
  agency: { id: string; name: string; logo_url: string | null } | null;
};

type AgencyRow = { id: string; name: string; logo_url: string | null; description: string | null; category: string | null };

function CategoryPage() {
  const { slug } = Route.useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string>("");
  const [list, setList] = useState<Ticket[]>([]);
  const [categoryAgencies, setCategoryAgencies] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyFilter, setAgencyFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [booking, setBooking] = useState<Ticket | null>(null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const confirmBooking = async () => {
    if (!booking) return;
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver un billet");
      navigate({ to: "/connexion" });
      return;
    }
    setSubmitting(true);
    try {
      const total = booking.price * qty;
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "BILLET",
        reservation_date: new Date().toISOString().split("T")[0],
        total_amount: total,
        paid_amount: 0,
        details: {
          partner_ticket_id: booking.id,
          title: booking.title,
          agency: booking.agency?.name ?? null,
          origin: booking.origin,
          destination: booking.destination,
          departure_at: booking.departure_at,
          unit_price: booking.price,
          quantity: qty,
          quote: [{ label: `${booking.title} × ${qty}`, amount: total }],
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Billet réservé ! Procédez au paiement.");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setSubmitting(false);
    }
  };



  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cat } = await supabase
        .from("ticket_categories" as any)
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();
      if (!cat) { setLoading(false); return; }
      setCategoryId((cat as any).id);
      setCategoryName((cat as any).name);
      const [ticketsRes, agenciesRes] = await Promise.all([
        supabase
          .from("partner_tickets" as any)
          .select("id, title, origin, destination, departure_at, price, seats_available, description, image_url, agency:partner_agencies_public(id, name, logo_url)")
          .eq("category_id", (cat as any).id)
          .eq("is_active", true)
          .order("departure_at", { ascending: true, nullsFirst: false }),
        supabase
          .from("partner_agencies_public" as any)
          .select("id, name, logo_url, description, category")
          .eq("category", slug),
      ]);
      setList(((ticketsRes.data as any) ?? []) as Ticket[]);
      setCategoryAgencies(((agenciesRes.data as any) ?? []) as AgencyRow[]);
      setLoading(false);
    })();
  }, [slug]);

  const agencies = useMemo(() => {
    const seen = new Map<string, string>();
    list.forEach((t) => t.agency && seen.set(t.agency.id, t.agency.name));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [list]);

  const filtered = useMemo(() => list.filter((t) => {
    if (agencyFilter && t.agency?.id !== agencyFilter) return false;
    if (minPrice && t.price < Number(minPrice)) return false;
    if (maxPrice && t.price > Number(maxPrice)) return false;
    if (dateFilter && t.departure_at) {
      const d = new Date(t.departure_at).toISOString().slice(0, 10);
      if (d !== dateFilter) return false;
    }
    return true;
  }), [list, agencyFilter, minPrice, maxPrice, dateFilter]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tous les billets
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TicketCategoryIcon slug={slug} className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{CATEGORY_LABELS[slug as TicketCategorySlug] ?? categoryName}</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} billet{filtered.length > 1 ? "s" : ""} disponible{filtered.length > 1 ? "s" : ""}</p>
          </div>
        </header>

        {categoryAgencies.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground">Agences {CATEGORY_LABELS[slug as TicketCategorySlug] ?? categoryName}</h2>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {categoryAgencies.map((a) => (
                <div key={a.id} className="flex min-w-[180px] shrink-0 items-center gap-2 rounded-xl border bg-card p-3">
                  {a.logo_url ? (
                    <img src={a.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    {a.description && <p className="truncate text-[10px] text-muted-foreground">{a.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)}>
            <option value="">Toutes agences</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Input type="number" placeholder="Prix min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <Input type="number" placeholder="Prix max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun billet ne correspond à vos critères.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {filtered.map((t) => (
              <article key={t.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                {t.image_url && (
                  <div className="h-36 w-full overflow-hidden bg-muted">
                    <img src={t.image_url} alt={t.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {t.agency?.logo_url && <img loading="lazy" decoding="async" src={t.agency.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" />}
                    <span className="text-xs font-semibold text-muted-foreground">{t.agency?.name ?? "Agence"}</span>
                  </div>
                  <h2 className="text-base font-bold">{t.title}</h2>
                  {(t.origin || t.destination) && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {t.origin ?? "—"} → {t.destination ?? "—"}
                    </p>
                  )}
                  {t.departure_at && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {new Date(t.departure_at).toLocaleString("fr-FR")}
                    </p>
                  )}
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {t.seats_available} place{t.seats_available > 1 ? "s" : ""}
                  </p>
                  {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-extrabold text-primary">{fmt(t.price)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
