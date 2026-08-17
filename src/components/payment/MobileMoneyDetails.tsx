import { Smartphone, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { MERCHANT_CODES } from "@/lib/payment-methods";
import { toast } from "sonner";

interface Props {
  channel: "airtel_money" | "moov_money";
  amount?: number;
}

export function MobileMoneyDetails({ channel, amount }: Props) {
  const [copied, setCopied] = useState(false);
  const code = MERCHANT_CODES[channel];
  const label = channel === "airtel_money" ? "Airtel Money" : "Moov Money";

  const onCopy = async () => {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      toast.success("Code marchand copié");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Copie impossible");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold">{label}</h3>
            <p className="text-xs text-muted-foreground">Paiement par code marchand</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/40 p-4">
          <p className="text-xs uppercase text-muted-foreground">Code marchand</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-xl font-extrabold tracking-wide">{code}</span>
            <Button size="sm" variant="outline" onClick={onCopy}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
        </div>

        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Composez le menu {label} sur votre téléphone.</li>
          <li>
            Choisissez « Paiement marchand » puis saisissez le code <strong>{code}</strong>.
          </li>
          {amount ? (
            <li>
              Entrez le montant exact de <strong>{amount.toLocaleString("fr-FR")} FCFA</strong>.
            </li>
          ) : (
            <li>Entrez le montant exact à payer.</li>
          )}
          <li>Validez, puis envoyez ici la capture ou le numéro de transaction comme justificatif.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
