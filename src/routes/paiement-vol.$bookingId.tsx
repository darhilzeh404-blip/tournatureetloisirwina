import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WalletCheckout } from "@/components/WalletCheckout";

export const Route = createFileRoute("/paiement-vol/$bookingId")({
  component: PayFlight,
});

const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

function PayFlight() {
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("flight_bookings") as any)
        .select("id,reference_code,total_amount,status,seats,contact_name")
        .eq("id", bookingId).maybeSingle();
      setBooking(data);
      setLoading(false);
    })();
  }, [bookingId, refresh]);

  if (loading) return <main className="p-8 text-center text-sm text-muted-foreground">Chargement…</main>;
  if (!booking) return <main className="p-8 text-center text-sm text-muted-foreground">Dossier introuvable.</main>;

  const isPaid = ["paid","confirmed_by_agency","ticket_ready","delivered"].includes(booking.status);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Link to="/mes-reservations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Mes réservations
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Paiement du vol</h1>
            <p className="text-sm text-muted-foreground">Dossier {booking.reference_code}</p>
          </div>
        </header>

        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between text-sm">
            <span>Passagers</span><span className="font-semibold">{booking.seats}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <span className="text-sm">Total</span>
            <span className="text-xl font-extrabold text-primary">{FCFA(booking.total_amount)}</span>
          </div>
        </div>

        {isPaid ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-green-500/40 bg-green-500/10 p-5">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-bold">Dossier confirmé</p>
              <p className="text-sm text-muted-foreground">L'agence traite votre billet.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <WalletCheckout
              purpose="flight_booking"
              relatedId={booking.id}
              amount={Number(booking.total_amount)}
              description={`Vol ${booking.reference_code}`}
              onSuccess={() => setRefresh((n) => n + 1)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
