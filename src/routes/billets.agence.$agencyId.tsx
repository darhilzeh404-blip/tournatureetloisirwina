import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Calendar, MapPin, Users, Minus, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/billets/agence/$agencyId")({
  component: AgencyTicketsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

type Agency = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  is_verified: boolean;
};

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
};

function AgencyTicketsPage() {
  const { agencyId } = Route.useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [booking, setBooking] = useState<Ticket | null>(null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const aRes = await supabase
        .from("partner_agencies_public" as any)
        .select("id, name, logo_url, description, category, is_verified")
        .eq("id", agencyId)
        .maybeSingle();
      let ag: Agency | null = aRes.data as any;
      if (!ag) {
        const fb = await supabase
          .from("partner_agencies" as any)
          .select("id, name, logo_url, description, category, is_verified")
          .eq("id", agencyId)
          .maybeSingle();
        ag = (fb.data as any) ?? null;
      }
      setAgency(ag);

      const tRes = await supabase
        .from("partner_tickets" as any)
        .select("id, title, origin, destination, departure_at, price, seats_available, description, image_url")
        .eq("agency_id", agencyId)
        .eq("is_active", true)
        .order("departure_at", { ascending: true, nullsFirst: false });
      setTickets(((tRes.data as any) ?? []) as Ticket[]);
      setLoading(false);
    })();
  }, [agencyId]);

  const filtered = useMemo(() => tickets.filter((t) => {
    if (minPrice && t.price < Number(minPrice)) return false;
    if (maxPrice && t.price > Number(maxPrice)) return false;
    if (dateFilter && t.departure_at) {
      const d = new Date(t.departure_at).toISOString().slice(0, 10);
      if (d !== dateFilter) return false;
    }
    return true;
  }), [tickets, minPrice, maxPrice, dateFilter]);

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
          agency: agency?.name ?? null,
          agency_id: agencyId,
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

  const backTo = agency?.category
    ? `/billets/categorie/${agency.category}`
    : "/billets";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link to={backTo as any} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux agences
        </Link>

        <header className="mt-6 flex items-center gap-3">
          {agency?.logo_url ? (
            <img src={agency.logo_url} alt="" className="h-14 w-14 rounded-full object-cover border" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/10" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{agency?.name ?? "Agence"}</h1>
              {agency?.is_verified && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  <BadgeCheck className="h-3 w-3" /> Vérifiée
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {filtered.length} billet{filtered.length > 1 ? "s" : ""} disponible{filtered.length > 1 ? "s" : ""}
            </p>
          </div>
        </header>

        {agency?.description && (
          <p className="mt-3 text-sm text-muted-foreground">{agency.description}</p>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Input type="number" placeholder="Prix min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <Input type="number" placeholder="Prix max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun billet disponible pour cette agence.
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
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-sm font-extrabold text-primary">{fmt(t.price)}</span>
                    <button
                      type="button"
                      onClick={() => { setBooking(t); setQty(1); }}
                      disabled={t.seats_available <= 0}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {t.seats_available <= 0 ? "Complet" : "Réserver"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !submitting && setBooking(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{booking.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{agency?.name ?? "Agence"}</p>
            {(booking.origin || booking.destination) && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {booking.origin ?? "—"} → {booking.destination ?? "—"}
              </p>
            )}
            {booking.departure_at && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> {new Date(booking.departure_at).toLocaleString("fr-FR")}
              </p>
            )}

            <div className="mt-4 rounded-xl border bg-background p-3">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-muted-foreground">Quantité</span>
                <div className="ml-auto flex items-center gap-3">
                  <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border" disabled={qty <= 1}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-lg font-extrabold">{qty}</span>
                  <button type="button" onClick={() => setQty(Math.min(booking.seats_available, qty + 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border" disabled={qty >= booking.seats_available}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-base font-extrabold text-primary">{fmt(booking.price * qty)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setBooking(null)} disabled={submitting} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold">
                Annuler
              </button>
              <button type="button" onClick={confirmBooking} disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Payer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
