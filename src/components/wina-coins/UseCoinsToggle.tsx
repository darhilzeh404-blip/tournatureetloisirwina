import { Coins, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { formatCoins, formatXAF } from "@/lib/wina-coins";

interface Props {
  balance: number;
  total: number;
  enabled: boolean;
  amount: number;
  onToggle: (v: boolean) => void;
  onAmountChange: (v: number) => void;
}

export function UseCoinsToggle({ balance, total, enabled, amount, onToggle, onAmountChange }: Props) {
  const max = Math.min(balance, total);
  if (balance <= 0) return null;
  return (
    <div className="rounded-2xl border border-primary/20 bg-[image:var(--gradient-wina-soft)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="flex items-center gap-1 text-sm font-semibold">
              Utiliser mes Wina Coins
              <Sparkles className="h-3 w-3 text-accent" />
            </p>
            <p className="text-[11px] text-muted-foreground">
              Solde disponible : {formatCoins(balance)} coins
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      {enabled && max > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Réduction appliquée</span>
            <span className="font-semibold text-primary">−{formatXAF(amount)}</span>
          </div>
          <Slider
            value={[amount]}
            min={0}
            max={max}
            step={50}
            onValueChange={(v) => onAmountChange(v[0] ?? 0)}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>{formatCoins(max)} coins max</span>
          </div>
        </div>
      )}
    </div>
  );
}
