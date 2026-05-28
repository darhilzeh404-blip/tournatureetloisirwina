import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import { formatCoins, type VipLevel } from "@/lib/wina-coins";
import { VipBadge } from "./VipBadge";
import { Progress } from "@/components/ui/progress";

interface Props {
  balance: number;
  totalEarned: number;
  level: VipLevel | null;
  nextLevel: VipLevel | null;
  progress: number;
}

export function CoinsBalanceCard({ balance, totalEarned, level, nextLevel, progress }: Props) {
  const remaining = nextLevel ? Math.max(nextLevel.min_coins - totalEarned, 0) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-premium)]"
      style={{ background: "var(--gradient-wina-premium)" }}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/70">
            <Coins className="h-3.5 w-3.5" /> Wina Coins
          </div>
          <motion.div
            key={balance}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-1 flex items-baseline gap-2"
          >
            <span className="text-4xl font-extrabold tracking-tight">{formatCoins(balance)}</span>
            <span className="text-sm text-white/70">coins</span>
          </motion.div>
          <p className="mt-1 text-xs text-white/60">
            {formatCoins(totalEarned)} gagnés au total
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <VipBadge level={level?.level_name} size="md" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
            {level?.level_name ?? "Silver"}
          </span>
        </div>
      </div>

      {nextLevel ? (
        <div className="relative mt-5 space-y-2">
          <div className="flex justify-between text-[11px] text-white/70">
            <span>Progression vers {nextLevel.level_name}</span>
            <span>{formatCoins(remaining)} coins restants</span>
          </div>
          <div className="overflow-hidden rounded-full bg-white/15">
            <Progress value={progress} className="h-2 bg-transparent [&>div]:bg-white" />
          </div>
        </div>
      ) : (
        <div className="relative mt-5 rounded-xl bg-white/10 p-3 text-center text-xs">
          ✨ Niveau maximum atteint — profitez de tous les avantages
        </div>
      )}
    </motion.div>
  );
}
