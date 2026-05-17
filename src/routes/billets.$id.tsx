import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Calendar, MapPin, Minus, Plus, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { getTicket } from "@/lib/tickets-catalog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/billets/$id")({
  head: () => ({
    meta: [
      { title: "Achat de billet — Agence Wina" },
      { name: "description", content: "Sélectionnez votre billet, vérifiez le récapitulatif et payez." },
    ],
  }),
  component: BilletDetailPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

function BilletDetailPage() {
  const { id } = Route.useParams();
  const ticket = getTicket(id);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const total = useMemo(() => (ticket?.price ?? 0) * qty, [ticket, qty]);

  if (!ticket) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">Billet introuvable.</p>
          <Link to="/billets" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <ArrowLeft className="h-4 w-4" /> Retour aux billets
          </Link>
        </div>
      </main>
    );
  }

  const handlePurchase = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour acheter un billet");
      navigate({ to: "/connexion" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "BILLET",
        reservation_date: new Date().toISOString().split("T")[0],
        total_amount: total,
        paid_amount: 0,
        details: {
          ticket_id: ticket.id,
          ticket_kind: ticket.kind,
          title: ticket.title,
          description: ticket.description,
          date: ticket.date,
          location: ticket.location,
          unit_price: ticket.price,
          quantity: qty,
          quote: [{ label: `${ticket.title} × ${qty}`, amount: total }],
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Billet réservé ! Procédez au paiement.");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tous les billets
        </Link>

        <div className="mt-6 rounded-3xl border bg-card p-5 shadow-sm">
          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {ticket.kind === "transport" ? "Transport" : "Événement"}
          </span>
          <h1 className="mt-2 text-xl font-bold">{ticket.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ticket.description}</p>
          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {ticket.date && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{ticket.date}</div>}
            {ticket.location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{ticket.location}</div>}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">Prix unitaire</span>
            <span className="text-lg font-extrabold text-primary">{fmt(ticket.price)}</span>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold">Quantité</h2>
          <div className="mt-3 flex items-center gap-4">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background text-lg font-bold disabled:opacity-50"
              disabled={qty <= 1}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-2xl font-extrabold">{qty}</span>
            <button type="button" onClick={() => setQty(Math.min(20, qty + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background text-lg font-bold">
              <Plus className="h-4 w-4" />
            </button>
            <span className="ml-auto text-xs text-muted-foreground">Max 20</span>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border-2 border-primary/20 bg-primary/5 p-5">
          <h2 className="text-sm font-bold text-primary">Récapitulatif</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{ticket.title}</span>
              <span>{fmt(ticket.price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantité</span>
              <span>× {qty}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-base font-extrabold text-primary">
              <span>Total à payer</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Paiement sécurisé par Mobile Money (Moov / Airtel).
          </p>
        </div>

        <button
          type="button"
          onClick={handlePurchase}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Création..." : `Payer ${fmt(total)}`}
        </button>
      </div>
    </main>
  );
}
