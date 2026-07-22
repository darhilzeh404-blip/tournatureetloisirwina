import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Smartphone, XCircle } from "lucide-react";

type Purpose = "reservation" | "wallet_recharge" | "partner_booking";
type Operator = "airtelmoney" | "moovmoney";

interface Props {
  purpose: Purpose;
  relatedId: string;
  amount: number;
  description?: string;
  onSuccess?: () => void;
}

export function MyPvitCheckout({ purpose, relatedId, amount, description, onSuccess }: Props) {
  const [operator, setOperator] = useState<Operator>("airtelmoney");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  async function initiate() {
    if (!/^\d{8,11}$/.test(phone.replace(/\D/g, ""))) {
      toast.error("Numéro invalide (8 chiffres locaux ou format 241XXXXXXXX)");
      return;
    }
    setSubmitting(true);
    setFailureReason(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Session expirée"); return; }

      const res = await fetch("/api/pvit/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purpose, related_id: relatedId, amount, operator, phone, description }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Échec de l'initiation");
        setStatus("failed");
        setFailureReason(body?.error || null);
        return;
      }
      setTransactionId(body.transactionId);
      setStatus("pending");
      toast.success("Push USSD envoyé — validez sur votre téléphone");
      startPolling(body.transactionId);
    } catch (e: any) {
      toast.error(e?.message || "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  function startPolling(id: string) {
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch(`/api/pvit/status/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json();
        if (body.status === "SUCCESS") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStatus("completed");
          toast.success("Paiement confirmé !");
          onSuccess?.();
        } else if (body.status === "FAILED" || body.status === "EXPIRED") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStatus("failed");
          setFailureReason(body.failure_reason || "Paiement refusé");
          toast.error(body.failure_reason || "Paiement refusé");
        } else if (attempts > 60) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStatus("failed");
          setFailureReason("Délai dépassé — réessayez");
          toast.error("Délai dépassé");
        }
      } catch { /* keep polling */ }
    };
    pollRef.current = window.setInterval(tick, 3000);
    void tick();
  }

  if (status === "completed") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/10 p-4">
        <CheckCircle2 className="h-6 w-6 text-green-500" />
        <div>
          <div className="font-semibold">Paiement confirmé</div>
          <div className="text-sm text-muted-foreground">Votre transaction est validée.</div>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <div className="flex-1">
          <div className="font-semibold">En attente de validation</div>
          <div className="text-sm text-muted-foreground">
            Confirmez la demande USSD sur votre téléphone ({phone}).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4" /> Mobile Money (MyPVit)
        </div>
        <RadioGroup value={operator} onValueChange={(v) => setOperator(v as Operator)} className="grid grid-cols-2 gap-2">
          <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${operator === "airtelmoney" ? "border-primary bg-primary/5" : ""}`}>
            <RadioGroupItem value="airtelmoney" />
            <span className="text-sm font-medium">Airtel Money</span>
          </label>
          <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${operator === "moovmoney" ? "border-primary bg-primary/5" : ""}`}>
            <RadioGroupItem value="moovmoney" />
            <span className="text-sm font-medium">Moov Money</span>
          </label>
        </RadioGroup>

        <div className="mt-4 space-y-2">
          <Label htmlFor="pvit-phone">Numéro du payeur</Label>
          <Input
            id="pvit-phone"
            inputMode="tel"
            placeholder="Ex : 077123456 ou 24177123456"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">Montant : {new Intl.NumberFormat("fr-FR").format(amount)} FCFA</div>
        </div>

        {failureReason && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            <XCircle className="h-4 w-4 mt-0.5" />
            <span>{failureReason}</span>
          </div>
        )}

        <Button onClick={initiate} disabled={submitting || !phone} className="mt-4 w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Payer ${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`}
        </Button>
      </div>
    </div>
  );
}
