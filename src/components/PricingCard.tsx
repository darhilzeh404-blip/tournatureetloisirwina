import { Check } from "lucide-react";

interface PricingCardProps {
  title: string;
  price: string;
  unit: string;
  features: string[];
  highlighted?: boolean;
  onSelect?: () => void;
}

export function PricingCard({ title, price, unit, features, highlighted, onSelect }: PricingCardProps) {
  return (
    <div className={`card-hover rounded-[var(--radius-card)] border p-6 shadow-[var(--shadow-card)] ${highlighted ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-card"}`}>
      {highlighted && (
        <span className="mb-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Recommandé
        </span>
      )}
      <h3 className="text-lg font-bold text-card-foreground">{title}</h3>
      <div className="mt-3">
        <span className="text-3xl font-extrabold text-foreground">{price}</span>
        <span className="ml-1 text-sm text-muted-foreground">{unit}</span>
      </div>
      <ul className="mt-5 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-accent" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${highlighted ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
      >
        Sélectionner
      </button>
    </div>
  );
}
