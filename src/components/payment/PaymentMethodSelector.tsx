import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PaymentChannel } from "@/lib/payment-methods";
import airtel3d from "@/assets/pay/airtel-money-3d.png";
import moov3d from "@/assets/pay/moov-money-3d.png";
import bank3d from "@/assets/pay/bank-transfer-3d.png";
import cash3d from "@/assets/pay/cash-3d.png";
import wallet3d from "@/assets/pay/wallet-3d.png";
import card3d from "@/assets/pay/card-3d.png";

interface Option {
  value: PaymentChannel;
  label: string;
  description: string;
  image: string;
  disabled?: boolean;
  badge?: string;
}

const BASE_OPTIONS: Option[] = [
  {
    value: "airtel_money",
    label: "Airtel Money",
    description: "Payez via le code marchand Airtel Money BGG94.",
    image: airtel3d,
  },
  {
    value: "moov_money",
    label: "Moov Money",
    description: "Payez via le code marchand Moov Money TRANSPORT.",
    image: moov3d,
  },
  {
    value: "bank_transfer",
    label: "Virement bancaire",
    description: "Effectuez votre virement et envoyez votre justificatif.",
    image: bank3d,
  },
  {
    value: "cash",
    label: "Paiement en espèces",
    description: "Rendez-vous dans une agence WINA TOUR pour régler votre réservation.",
    image: cash3d,
  },
  {
    value: "wallet",
    label: "Portefeuille WINA TOUR",
    description: "Payez directement avec votre solde disponible.",
    image: wallet3d,
  },
  {
    value: "card",
    label: "Carte bancaire",
    description: "Temporairement indisponible",
    image: card3d,
    disabled: true,
    badge: "Bientôt disponible",
  },
];



interface Props {
  /** Moyens autorisés pour ce service (ex. VTC = portefeuille uniquement). */
  allowed?: PaymentChannel[];
  /** Masquer le portefeuille (ex. recharge du portefeuille). */
  hideWallet?: boolean;
  note?: string;
  onContinue: (channel: PaymentChannel) => void;
}

export function PaymentMethodSelector({ allowed, hideWallet, note, onContinue }: Props) {
  const [selected, setSelected] = useState<PaymentChannel | null>(null);

  const options = BASE_OPTIONS.filter((o) => {
    if (hideWallet && o.value === "wallet") return false;
    if (allowed && !allowed.includes(o.value) && o.value !== "card") return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Choisissez votre moyen de paiement</h2>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>

      <div className="grid gap-3">
        {options.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              aria-disabled={o.disabled}
              onClick={() => !o.disabled && setSelected(o.value)}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                o.disabled
                  ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                  : active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    active ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/60"
                  }`}
                >
                  <img
                    src={o.image}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    width={512}
                    height={512}
                    className="h-9 w-9 object-contain"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.label}</span>
                    {o.badge && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {o.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{o.description}</p>
                </div>
                <span
                  className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                    active ? "border-primary bg-primary" : "border-muted-foreground/40"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4">
          <Button size="lg" className="w-full" disabled={!selected} onClick={() => selected && onContinue(selected)}>
            Continuer <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Le choix d'un moyen de paiement ne vaut pas paiement : la confirmation dépend de la procédure choisie.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
