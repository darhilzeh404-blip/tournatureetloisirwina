import { Phone, LifeBuoy } from "lucide-react";

export const SUPPORT_PHONE = "066264890";
export const SUPPORT_PHONE_DISPLAY = "066 26 48 90";
export const SUPPORT_TEL_HREF = "tel:+241066264890";

/**
 * Bloc support réutilisable. `variant="inline"` pour un simple lien discret,
 * `variant="card"` pour un encart complet (aide, profil, erreurs).
 */
export function SupportContact({
  variant = "card",
  className = "",
}: {
  variant?: "card" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <a
        href={SUPPORT_TEL_HREF}
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline ${className}`}
      >
        <Phone className="h-3.5 w-3.5" />
        {SUPPORT_PHONE_DISPLAY}
      </a>
    );
  }

  return (
    <div className={`rounded-2xl border border-border bg-card/60 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <LifeBuoy className="h-4.5 w-4.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Besoin d'aide ?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Notre équipe support est disponible pour vous accompagner.
          </p>
          <a
            href={SUPPORT_TEL_HREF}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Phone className="h-4 w-4" />
            {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </div>
  );
}
