import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { UseCoinsToggle } from "@/components/wina-coins/UseCoinsToggle";
import { fetchBalance } from "@/lib/wina-coins";
import { isNightHoursNow, requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { WalletCheckout } from "@/components/WalletCheckout";
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";
import { MyPvitCheckout } from "@/components/payment/MyPvitCheckout";

import { PAYMENT_CHANNEL_LABEL, type PaymentChannel } from "@/lib/payment-methods";

export const Route = createFileRoute("/paiement/$reservationId")({
  head: () => ({
    meta: [
      { title: "Paiement — Agence Wina" },
      {
        name: "description",
        content:
          "Choisissez votre moyen de paiement : Airtel Money, Moov Money ou portefeuille WINA TOUR.",
      },
    ],
  }),
  component: PaiementPage,
});

interface Reservation {
  id: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  user_id: string;
  coins_used: number;
  service_type: string;
  details: Record<string, any> | null;
}

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function PaiementPage() {
  const { reservationId } = Route.useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [coinsBalance, setCoinsBalance] = useState<number>(0);
  const [coinsEnabled, setCoinsEnabled] = useState(false);
  const [coinsAmount, setCoinsAmount] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/connexion" });
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, total_amount, paid_amount, status, user_id, coins_used, service_type, details")
        .eq("id", reservationId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Réservation introuvable");
        navigate({ to: "/mes-reservations" });
        return;
      }
      setReservation(data as unknown as Reservation);
      const alreadySpent = data.coins_used ?? 0;
      const remainingDue = Math.max(data.total_amount - data.paid_amount - alreadySpent, 0);
      setAmount(remainingDue || data.total_amount);
      const bal = await fetchBalance(user.id);
      setCoinsBalance(bal?.coins_balance ?? 0);
      setLoading(false);
    })();
  }, [authLoading, user, reservationId, navigate]);

  // Recalcul automatique du montant à payer lorsque la réduction coins change
  useEffect(() => {
    if (!reservation) return;
    const discount = coinsEnabled ? coinsAmount : 0;
    const alreadySpent = reservation.coins_used ?? 0;
    const net = Math.max(reservation.total_amount - reservation.paid_amount - alreadySpent - discount, 0);
    setAmount(net);
  }, [coinsEnabled, coinsAmount, reservation]);

  const isVtc = reservation?.service_type === "VTC";
  const isMobileMoney = channel === "airtel_money" || channel === "moov_money";

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!reservation) return null;

  const walletAmount = Math.max(
    reservation.total_amount - reservation.paid_amount - (reservation.coins_used ?? 0),
    0,
  );

  return (
    <div className="container mx-auto max-w-3xl px-4 pt-20 sm:pt-6 space-y-6 pb-24">
      <Link to="/mes-reservations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à mes réservations
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Paiement</h1>
        <p className="text-sm text-muted-foreground">Réservation #{reservation.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {reservation.service_type === "VTC" && isNightHoursNow() && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-700">💵 Heures de nuit (22h → 06h)</p>
          <p className="mt-1 text-xs text-amber-700/80">
            Pour les courses VTC entre 22h et 06h, le paiement se fait <strong>en espèces directement au chauffeur</strong> à l'arrivée.
          </p>
        </div>
      )}

      {/* Récap montant */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total à payer</span>
            <span className="font-semibold">{formatXAF(reservation.total_amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Déjà payé</span>
            <span>{formatXAF(reservation.paid_amount)}</span>
          </div>
          {(reservation.coins_used ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-primary">
              <span>Réduction Wina Coins déjà appliquée</span>
              <span>−{formatXAF(reservation.coins_used)}</span>
            </div>
          )}
          {(reservation.coins_used ?? 0) === 0 && channel !== "wallet" && !paymentLocked && (
            <UseCoinsToggle
              balance={coinsBalance}
              total={Math.max(reservation.total_amount - reservation.paid_amount - 1, 0)}
              enabled={coinsEnabled}
              amount={coinsAmount}
              onToggle={(v) => {
                setCoinsEnabled(v);
                if (!v) setCoinsAmount(0);
              }}
              onAmountChange={setCoinsAmount}
            />
          )}
          {coinsEnabled && coinsAmount > 0 && (
            <div className="flex justify-between text-sm text-primary">
              <span>Réduction Wina Coins</span>
              <span>−{formatXAF(coinsAmount)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Étape 1 — choix du moyen de paiement */}
      {channel === null ? (
        <PaymentMethodSelector
          allowed={isVtc ? ["wallet"] : ["airtel_money", "moov_money", "wallet"]}
          note={
            isVtc
              ? "Pour les courses VTC, le règlement se fait exclusivement depuis le portefeuille WINA TOUR."
              : `Montant restant dû : ${formatXAF(amount)}`
          }
          onContinue={setChannel}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setChannel(null)}
            disabled={paymentLocked}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Changer de moyen de paiement ({PAYMENT_CHANNEL_LABEL[channel]})
          </button>

          {/* Portefeuille */}
          {channel === "wallet" && (
            <Card className="border-green-500/40 bg-green-500/5">
              <CardContent className="p-5 space-y-3">
                <div>
                  <p className="text-sm font-bold">👛 Portefeuille WINA TOUR</p>
                  <p className="text-xs text-muted-foreground">
                    Réservation confirmée immédiatement après débit du solde.
                  </p>
                </div>
                <WalletCheckout
                  purpose="reservation"
                  relatedId={reservation.id}
                  amount={walletAmount}
                  onSuccess={() =>
                    ((reservation.details as any)?.train_booking || (reservation.details as any)?.mode === "bateau")
                      ? navigate({ to: "/billets/confirmation/$reservationId", params: { reservationId: reservation.id } })
                      : navigate({ to: "/confirmation/$reservationId", params: { reservationId: reservation.id } })
                  }
                />
              </CardContent>
            </Card>
          )}

          {isMobileMoney && (
            <MyPvitCheckout
              purpose="reservation"
              reservationId={reservation.id}
              channel={channel as "airtel_money" | "moov_money"}
              amount={amount}
              onLockChange={setPaymentLocked}
              beforeStart={async () => {
                if (coinsEnabled && coinsAmount > 0 && !reservation.coins_used) {
                  const { error } = await supabase.rpc("spend_wina_coins", { _reservation_id: reservation.id, _amount: coinsAmount });
                  if (error) throw error;
                  setReservation({ ...reservation, coins_used: coinsAmount });
                  setCoinsEnabled(false);
                  setCoinsAmount(0);
                }
              }}
              onSuccess={() => {
                toast.success("Paiement confirmé.");
                if (reservation.details?.train_booking || reservation.details?.mode === "bateau") {
                  navigate({ to: "/billets/confirmation/$reservationId", params: { reservationId: reservation.id } });
                } else {
                  navigate({ to: "/confirmation/$reservationId", params: { reservationId: reservation.id } });
                }
              }}
            />
          )}

        </>
      )}
    </div>
  );
}
