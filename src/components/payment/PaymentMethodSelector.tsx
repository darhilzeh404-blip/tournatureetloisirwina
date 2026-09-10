import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PaymentChannel } from "@/lib/payment-methods";
import wallet3d from "@/assets/pay/wallet-3d.png";

// Logos de marque utilisés uniquement pour identifier les moyens de paiement.
const AIRTEL_MONEY_LOGO =
  "https://www.madigipaie.com/logo-airtel-money.png";
const MOOV_MONEY_LOGO = "https://kaybicafrica.com/img/partners/moov.png";

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
    description: "Paiement depuis votre compte Airtel Money.",
    image: AIRTEL_MONEY_LOGO,
  },
  {
    value: "moov_money",
    label: "Moov Money",
    description: "Paiement depuis votre compte Moov Money.",
    image: MOOV_MONEY_LOGO,
  },
  {
    value: "wallet",
    label: "Portefeuille WINA TOUR",
    description: "Payez directement avec votre solde disponible.",
    image: wallet3d,
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
  const [advancing, setAdvancing] = useState(false);
  const consumed = useRef<PaymentChannel | null>(null);
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;

  // Sélection = validation : on enchaîne automatiquement sur l'étape suivante,
  // sans clic « Continuer » supplémentaire (une seule fois par choix).
  useEffect(() => {
    if (!selected || consumed.current === selected) return;
    setAdvancing(true);
    const t = setTimeout(() => {
      consumed.current = selected;
      setAdvancing(false);
      continueRef.current(selected);
    }, 450);
    return () => clearTimeout(t);
  }, [selected]);

  const options = BASE_OPTIONS.filter((o) => {
    if (hideWallet && o.value === "wallet") return false;
    if (allowed && !allowed.includes(o.value)) return false;
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
                    referrerPolicy="no-referrer"
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

      {advancing ? (
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
          <Loader2 className="h-4 w-4 animate-spin" /> Ouverture du paiement…
        </div>
      ) : !selected ? (
        <p className="text-center text-sm text-muted-foreground">
          Sélectionnez un moyen de paiement pour continuer.
        </p>
      ) : null}
    </div>
  );
}
