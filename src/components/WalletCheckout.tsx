import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchVtcWallet,
  formatXAF,
  payFlightBookingWithWallet,
  payPartnerBookingWithWallet,
  payReservationWithWallet,
  walletErrorMessage,
} from "@/lib/vtc-wallet";

export type WalletPurpose = "reservation" | "partner_booking" | "flight_booking";

interface Props {
  purpose: WalletPurpose;
  relatedId: string;
  amount: number;
  onSuccess?: () => void;
}

export function WalletCheckout({ purpose, relatedId, amount, onSuccess }: Props) {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) return;
    fetchVtcWallet(user.id)
      .then((w) => { if (alive) setBalance(w.balance_points); })
      .catch(() => { if (alive) setBalance(0); });
    return () => { alive = false; };
  }, [user]);

  const pay = async () => {
    if (!user) return;
    setPaying(true);
    try {
      const res =
        purpose === "reservation"
          ? await payReservationWithWallet(relatedId)
          : purpose === "partner_booking"
            ? await payPartnerBookingWithWallet(relatedId)
            : await payFlightBookingWithWallet(relatedId);
      setBalance(res.new_balance);
      setDone(true);
      toast.success("Paiement effectué depuis votre portefeuille");
      onSuccess?.();
    } catch (e) {
      toast.error(walletErrorMessage(e));
    } finally {
      setPaying(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/10 p-4">
        <CheckCircle2 className="h-6 w-6 text-green-500" />
        <div>
          <div className="font-semibold">Paiement confirmé</div>
          <div className="text-sm text-muted-foreground">Débité de votre portefeuille Wina.</div>
        </div>
      </div>
    );
  }

  const insufficient = balance !== null && balance < amount;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wallet className="h-4 w-4 text-primary" /> Portefeuille Wina
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Solde disponible</span>
        <span className="font-bold">
          {balance === null ? <Loader2 className="h-4 w-4 animate-spin" /> : formatXAF(balance)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Montant à payer</span>
        <span className="font-bold text-primary">{formatXAF(amount)}</span>
      </div>

      {insufficient && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>
            Solde insuffisant — il manque {formatXAF(amount - (balance ?? 0))}. Rechargez votre portefeuille
            pour finaliser ce paiement.
          </span>
        </div>
      )}

      {insufficient ? (
        <Button asChild className="w-full">
          <Link to="/wallet/recharger">Recharger mon portefeuille</Link>
        </Button>
      ) : (
        <Button onClick={pay} disabled={paying || balance === null || amount <= 0} className="w-full">
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Payer ${formatXAF(amount)}`}
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Tous les paiements de l'application passent par le portefeuille Wina.
      </p>
    </div>
  );
}
