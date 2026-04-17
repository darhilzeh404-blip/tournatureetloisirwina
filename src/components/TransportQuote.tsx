import { Quote, formatXAF } from "@/hooks/use-transport-data";
import { Receipt } from "lucide-react";

export function TransportQuote({ quote }: { quote: Quote }) {
  if (!quote.lines.length) return null;
  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
      <div className="mb-3 flex items-center gap-2 text-primary">
        <Receipt className="h-5 w-5" />
        <h3 className="font-bold">Devis détaillé</h3>
      </div>
      <ul className="divide-y divide-border/50">
        {quote.lines.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="text-muted-foreground">{l.label}</span>
            <span className="font-semibold whitespace-nowrap">{formatXAF(l.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm font-medium">Total estimé</span>
        <span className="text-2xl font-extrabold text-primary">{formatXAF(quote.total)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Acompte de 50% requis à la réservation.</p>
    </div>
  );
}
