import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadTrainReceipt, type TrainReceiptData } from "@/lib/train-receipt";
import { downloadBoatReceipt, type BoatReceiptData } from "@/lib/boat-receipt";
import { toast } from "sonner";

export const Route = createFileRoute("/billets/confirmation/$reservationId")({
  head: () => ({
    meta: [
      { title: "Paiement reçu — WINA TOUR" },
      { name: "description", content: "Votre paiement est reçu, votre billet est en cours de traitement." },
    ],
  }),
  component: BilletConfirmationPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

function BilletConfirmationPage() {
  const { reservationId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<TrainReceiptData | null>(null);
  const [boatReceipt, setBoatReceipt] = useState<BoatReceiptData | null>(null);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("reservations")
        .select("id, total_amount, paid_amount, created_at, details")
        .eq("id", reservationId)
        .maybeSingle();
      if (data) {
        const d = (data.details ?? {}) as Record<string, any>;
        const paid = data.paid_amount || data.total_amount;
        setAmount(paid);
        const reference = d.reference_code ?? data.id.slice(0, 8).toUpperCase();
        if (d.mode === "bateau") {
          setBoatReceipt({
            reference,
            agency: d.agency ?? "—",
            vessel: d.vessel ?? "—",
            origin: d.origin ?? "—",
            destination: d.destination ?? "—",
            departureDate: d.departure_date ? new Date(d.departure_date).toLocaleDateString("fr-FR") : "—",
            departureTime: d.departure_time ? String(d.departure_time).slice(0, 5) : null,
            returnDate: d.return_date ? new Date(d.return_date).toLocaleDateString("fr-FR") : null,
            passenger: d.passenger_name ?? "—",
            passengerPhone: d.passenger_phone ?? null,
            passengerEmail: d.passenger_email ?? null,
            adults: d.adults ?? 0,
            children: d.children ?? 0,
            infants: d.infants ?? 0,
            passengers: d.passengers ?? [],
            baggageKg: d.baggage_kg ?? 0,
            baggageFee: d.baggage_fee ?? 0,
            services: d.services ?? [],
            amountPaid: paid,
            paidAt: new Date().toLocaleString("fr-FR"),
          });
        } else {
          setReceipt({
            reference,
            agency: d.agency ?? "—",
            trainType: d.train_type ?? "—",
            travelClass: d.travel_class ?? "—",
            departureDate: d.departure_date ? new Date(d.departure_date).toLocaleDateString("fr-FR") : "—",
            origin: d.station_from ?? d.origin ?? "—",
            destination: d.station_to ?? d.destination ?? "—",
            passenger: d.passenger_name ?? "—",
            passengerPhone: d.passenger_phone ?? null,
            passengerEmail: d.passenger_email ?? null,
            idDocument: d.id_document_label ?? null,
            children: d.children ?? [],
            baggageCount: d.baggage_count ?? 0,
            baggageFee: d.baggage_fee ?? 0,
            grossTotal: d.gross_total,
            discountLines: d.discounts ?? [],
            amountPaid: paid,
            paidAt: new Date().toLocaleString("fr-FR"),
          });
        }
      }
      setLoading(false);
    })();
  }, [reservationId]);



  const download = async () => {
    if (boatReceipt) {
      const { downloadBoatReceipt } = await import("@/lib/boat-receipt");
      downloadBoatReceipt(boatReceipt);
    } else if (receipt) {
      const { downloadTrainReceipt } = await import("@/lib/train-receipt");
      downloadTrainReceipt(receipt);
    } else return;
    toast.success("Reçu PDF téléchargé");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-5 py-10">
        <div className="rounded-3xl border bg-card p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 text-xl font-bold">Votre paiement a bien été reçu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre billet est en cours de traitement. Veuillez patienter jusqu'à 24 heures pour recevoir votre billet physique.
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700">
            <Clock className="h-4 w-4" /> Billet en cours de traitement
          </div>

          {receipt && (
            <dl className="mt-6 space-y-2 text-left text-sm">
              {[
                ["Référence", receipt.reference],
                ["Agence", receipt.agency],
                ["Train", receipt.trainType],
                ["Classe", receipt.travelClass],
                ["Date", receipt.departureDate],
                ["Trajet", `${receipt.origin} → ${receipt.destination}`],
                ["Voyageur", receipt.passenger],
                ["Montant payé", fmt(amount)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {boatReceipt && (
            <dl className="mt-6 space-y-2 text-left text-sm">
              {[
                ["Référence", boatReceipt.reference],
                ["Agence", boatReceipt.agency],
                ["Navire", boatReceipt.vessel],
                ["Trajet", `${boatReceipt.origin} → ${boatReceipt.destination}`],
                ["Date", `${boatReceipt.departureDate}${boatReceipt.departureTime ? ` à ${boatReceipt.departureTime}` : ""}`],
                ["Voyageurs", `${boatReceipt.adults} adulte(s), ${boatReceipt.children} enfant(s), ${boatReceipt.infants} bébé(s)`],
                ["Voyageur principal", boatReceipt.passenger],
                ["Montant payé", fmt(amount)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <button
            type="button"
            onClick={download}
            disabled={!receipt && !boatReceipt}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Télécharger le reçu PDF
          </button>

          <Link
            to="/mes-reservations"
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Voir mes réservations
          </Link>
        </div>
      </div>
    </main>
  );
}
