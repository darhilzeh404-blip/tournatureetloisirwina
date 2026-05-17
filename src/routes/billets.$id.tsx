import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Minus, Plus, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type DbTicket = {
  id: string;
  title: string;
  price: number;
  description: string;
  conditions: string;
  images: string[];
  is_active: boolean;
};

function BilletDetailPage() {
  const { id } = Route.useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<DbTicket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    supabase
      .from("tickets" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setTicket((data as any) ?? null);
        setLoadingTicket(false);
      });
  }, [id]);

  const total = useMemo(() => (ticket?.price ?? 0) * qty, [ticket, qty]);

  if (loadingTicket) {
    return <main className="min-h-screen bg-background"><p className="p-10 text-center text-sm text-muted-foreground">Chargement…</p></main>;
  }

  if (!ticket || !ticket.is_active) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">Billet introuvable ou indisponible.</p>
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
          title: ticket.title,
          description: ticket.description,
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

  const images = ticket.images ?? [];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tous les billets
        </Link>

        {images.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-3xl border bg-muted">
            <img src={images[activeImage]} alt={ticket.title} className="h-64 w-full object-cover sm:h-80" />
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === activeImage ? "border-primary" : "border-transparent"}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 rounded-3xl border bg-card p-5 shadow-sm">
          <h1 className="text-xl font-bold">{ticket.title}</h1>
          {ticket.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>
          )}
          <div className="mt-4 flex items-baseline justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">Prix unitaire</span>
            <span className="text-lg font-extrabold text-primary">{fmt(ticket.price)}</span>
          </div>
        </div>

        {ticket.conditions && (
          <div className="mt-5 rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold">Conditions</h2>
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{ticket.conditions}</p>
          </div>
        )}

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
