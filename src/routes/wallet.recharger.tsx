import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Loader2, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { formatPoints, formatXAF } from "@/lib/vtc-wallet";
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";
import { MyPvitCheckout } from "@/components/payment/MyPvitCheckout";

import { PAYMENT_CHANNEL_LABEL, type PaymentChannel } from "@/lib/payment-methods";

const QUICK_AMOUNTS = [2000, 5000, 10000, 20000, 50000];

export const Route = createFileRoute("/wallet/recharger")({
  head: () => ({
    meta: [
      { title: "Recharger mon portefeuille — Wina" },
      {
        name: "description",
        content: "Rechargez votre portefeuille WINA TOUR par Airtel Money ou Moov Money.",
      },
    ],
  }),
  component: WalletRechargePage,
});

function WalletRechargePage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(5000);
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [paymentLocked, setPaymentLocked] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/connexion" });
  }, [authLoading, user, navigate]);

  const isMobileMoney = channel === "airtel_money" || channel === "moov_money";

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 pt-20 sm:pt-6 space-y-6 pb-24">
      <Link to="/wallet" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au portefeuille
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" /> Recharger mon portefeuille
        </h1>
        <p className="text-sm text-muted-foreground">
          Portefeuille WINA TOUR — utilisé pour tous vos achats et réservations dans l'application.
        </p>
      </div>

      {/* Étape 1 — Montant */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <Label htmlFor="amount" className="text-xs">Montant à recharger (1 point = 1 FCFA)</Label>
          <NumberInput
            id="amount"
            value={amount}
            disabled={paymentLocked}
            onChange={(v) => setAmount(Number(v) || 0)}
            min={500}
            className="mt-1 flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xl font-bold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                disabled={paymentLocked}
                onClick={() => setAmount(a)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  amount === a ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                }`}
              >
                {formatPoints(a)} FCFA
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Crédit du portefeuille : {formatXAF(amount)} après confirmation du paiement.
          </p>
        </CardContent>
      </Card>

      {/* Étape 2 — Moyen de paiement */}
      {channel === null ? (
        <PaymentMethodSelector
          hideWallet
          allowed={["airtel_money", "moov_money"]}
          note="Choisissez votre moyen de paiement."
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

          {isMobileMoney && (
            <MyPvitCheckout
              purpose="wallet_recharge"
              channel={channel as "airtel_money" | "moov_money"}
              amount={amount}
              onLockChange={setPaymentLocked}
              onSuccess={() => {
                toast.success("Votre portefeuille a été crédité.");
                navigate({ to: "/wallet" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
