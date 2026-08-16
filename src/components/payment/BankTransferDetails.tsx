import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { copyText } from "@/lib/clipboard";
import { BANK_DETAILS } from "@/lib/payment-methods";

export function BankTransferDetails() {
  const copyAccount = async () => {
    const ok = await copyText(BANK_DETAILS.accountNumber);
    if (ok) toast.success("Numéro de compte copié");
    else toast.error("Copie impossible — sélectionnez le numéro manuellement");
  };

  return (
    <Card className="border border-border bg-muted/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">Dénomination</span>
          <span className="text-sm font-semibold">{BANK_DETAILS.accountName}</span>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">Banque</span>
          <span className="text-sm font-semibold">{BANK_DETAILS.bankName}</span>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">Numéro de compte</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{BANK_DETAILS.accountNumber}</span>
            <button
              type="button"
              onClick={copyAccount}
              className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            >
              <Copy className="h-3 w-3" /> Copier
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
