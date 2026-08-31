import { toast as sonner } from "sonner";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { describeError } from "./app-errors";

type Variant = "success" | "error" | "info" | "warning";

const STYLES: Record<Variant, { icon: typeof CheckCircle2; ring: string; iconBg: string; iconFg: string }> = {
  success: { icon: CheckCircle2, ring: "border-emerald-500/30", iconBg: "bg-emerald-500/15", iconFg: "text-emerald-500" },
  error: { icon: XCircle, ring: "border-red-500/30", iconBg: "bg-red-500/15", iconFg: "text-red-500" },
  info: { icon: Info, ring: "border-sky-500/30", iconBg: "bg-sky-500/15", iconFg: "text-sky-500" },
  warning: { icon: AlertTriangle, ring: "border-amber-500/30", iconBg: "bg-amber-500/15", iconFg: "text-amber-500" },
};

function render(variant: Variant, title: string, description?: string) {
  const s = STYLES[variant];
  const Icon = s.icon;
  return (id: string | number) => (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border ${s.ring} bg-card/95 px-4 py-3 shadow-xl backdrop-blur-md sm:max-w-sm`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.iconBg}`}>
        <Icon className={`h-4.5 w-4.5 ${s.iconFg}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Fermer la notification"
        onClick={() => sonner.dismiss(id)}
        className="-mr-1 mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function show(variant: Variant, title: string, description?: string, duration = 4500) {
  // unstyled: le rendu custom apporte déjà son propre fond/bordure/ombre
  return sonner.custom(render(variant, title, description), { duration, unstyled: true });
}

/** Système de notifications unifié WINA TOUR. */
export const appToast = {
  success: (title: string, description?: string) => show("success", title, description),
  error: (title: string, description?: string) => show("error", title, description, 6000),
  info: (title: string, description?: string) => show("info", title, description),
  warning: (title: string, description?: string) => show("warning", title, description, 5500),
  /** Transforme une erreur brute en notification lisible. */
  fromError: (err: unknown) => {
    const { title, description } = describeError(err);
    return show("error", title, description, 6000);
  },
  dismiss: sonner.dismiss,
  loading: (title: string) => sonner.loading(title),
};
