import { motion } from "framer-motion";
import { Loader2, AlertTriangle, Radar, CheckCircle2, CarFront, WifiOff } from "lucide-react";
import { SupportContact } from "@/components/SupportContact";

export type VtcStateKind = "processing" | "searching" | "error" | "no_driver" | "success" | "offline";

const PRESETS: Record<VtcStateKind, { icon: React.ComponentType<{ className?: string }>; spin?: boolean; tone: string }> = {
  processing: { icon: Loader2, spin: true, tone: "text-primary bg-primary/10" },
  searching: { icon: Radar, tone: "text-primary bg-primary/10" },
  error: { icon: AlertTriangle, tone: "text-destructive bg-destructive/10" },
  no_driver: { icon: CarFront, tone: "text-amber-500 bg-amber-500/10" },
  success: { icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10" },
  offline: { icon: WifiOff, tone: "text-muted-foreground bg-muted" },
};

/**
 * Écran d'état plein cadre du parcours VTC (traitement, recherche de chauffeur,
 * erreur, aucun chauffeur, succès). Toujours accompagné d'une action de sortie
 * pour ne jamais laisser le client bloqué.
 */
export function VtcStateScreen({
  kind,
  title,
  description,
  steps,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  showSupport,
}: {
  kind: VtcStateKind;
  title: string;
  description?: string;
  /** Étapes du traitement en cours : [libellé, terminé ?] */
  steps?: Array<{ label: string; done: boolean }>;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  showSupport?: boolean;
}) {
  const preset = PRESETS[kind];
  const Icon = preset.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-border/60 bg-card/95 p-6 text-center shadow-sm backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        {(kind === "searching" || kind === "processing") && (
          <motion.span
            className="absolute inset-0 rounded-full bg-primary/15"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span className={`relative flex h-16 w-16 items-center justify-center rounded-3xl ${preset.tone}`}>
          <Icon className={`h-8 w-8 ${preset.spin ? "animate-spin" : ""}`} />
        </span>
      </div>

      <h2 className="mt-4 text-[17px] font-extrabold text-foreground">{title}</h2>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      )}

      {steps && steps.length > 0 && (
        <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 rounded-2xl bg-secondary/50 px-3 py-2">
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              )}
              <span className="text-[12.5px] font-semibold text-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      )}

      {(primaryLabel || secondaryLabel) && (
        <div className="mt-6 flex flex-col gap-2">
          {primaryLabel && (
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[13.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-border bg-card text-[13.5px] font-bold text-foreground transition-transform active:scale-[0.98]"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}

      {showSupport && <SupportContact className="mt-5 text-left" />}
    </motion.section>
  );
}
