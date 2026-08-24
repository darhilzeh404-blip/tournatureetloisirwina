import { motion } from "framer-motion";
import { Check } from "lucide-react";

export interface VtcStep {
  id: string;
  label: string;
}

/**
 * En-tête de progression du parcours VTC.
 * Une étape déjà validée est cliquable pour revenir en arrière.
 */
export function VtcStepper({
  steps,
  current,
  onGoTo,
}: {
  steps: VtcStep[];
  current: number;
  onGoTo?: (index: number) => void;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/90 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= current;
          return (
            <div key={s.id} className="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                type="button"
                disabled={!reachable || !onGoTo}
                onClick={() => reachable && onGoTo?.(i)}
                aria-current={active ? "step" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 disabled:cursor-default"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold transition-colors ${
                    done
                      ? "bg-primary/15 text-primary"
                      : active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={`w-full truncate text-center text-[10px] font-bold leading-tight ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className="relative mb-4 h-0.5 w-4 shrink-0 overflow-hidden rounded-full bg-border">
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-primary"
                    initial={false}
                    animate={{ width: done ? "100%" : "0%" }}
                    transition={{ duration: 0.3 }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
