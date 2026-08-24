import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export type SuccessDetail = { label: string; value: ReactNode };

type Action = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
};

type Props = {
  icon?: ReactNode;
  title: string;
  message: string;
  details?: SuccessDetail[];
  actions?: Action[];
  note?: string;
};

/**
 * Écran de confirmation réutilisable : icône, titre, message contextuel,
 * récapitulatif optionnel et actions claires.
 */
export function SuccessScreen({ icon, title, message, details, actions = [], note }: Props) {
  return (
    <section className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon ?? <CheckCircle2 className="h-9 w-9" />}
        </div>
        <h1 className="mt-5 text-xl font-bold leading-snug text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>

        {details && details.length > 0 && (
          <dl className="mt-6 space-y-2 text-left text-sm">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-3 border-b pb-1.5 last:border-b-0">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="text-right font-medium text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {note && <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">{note}</p>}

        <div className="mt-6 space-y-2.5">
          {actions.map((a) => {
            const cls =
              a.variant === "ghost"
                ? "flex w-full items-center justify-center rounded-2xl border py-3.5 text-sm font-semibold text-foreground"
                : "flex w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground";
            return a.to ? (
              <Link key={a.label} to={a.to as any} className={cls} onClick={a.onClick}>
                {a.label}
              </Link>
            ) : (
              <button key={a.label} type="button" onClick={a.onClick} className={cls}>
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
