import { Award, Crown, Gem, Sparkles, Trophy } from "lucide-react";
import { tierGradient } from "@/lib/wina-coins";

const iconMap = {
  silver: Award,
  gold: Trophy,
  platinum: Crown,
  diamond: Gem,
  "diamond-plus": Sparkles,
} as const;

export function VipBadge({
  level,
  size = "md",
}: {
  level: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const key = (level || "silver").toLowerCase().replace("+", "-plus");
  const Icon = (iconMap as Record<string, typeof Award>)[key] ?? Award;
  const dims = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const iconSize = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div
      className={`${dims} relative flex items-center justify-center rounded-full shadow-[var(--shadow-coin-glow)] ring-2 ring-white/40`}
      style={{ backgroundImage: tierGradient(level) }}
    >
      <Icon className={`${iconSize} text-white drop-shadow`} strokeWidth={2.2} />
    </div>
  );
}
