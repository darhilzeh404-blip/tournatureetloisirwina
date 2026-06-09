import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, History, Sparkles, TrendingUp, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CoinsBalanceCard } from "@/components/wina-coins/CoinsBalanceCard";
import { VipBadge } from "@/components/wina-coins/VipBadge";
import { ClientNav } from "@/components/ClientNav";
import {
  fetchBalance,
  fetchLevels,
  formatCoins,
  formatXAF,
  levelOf,
  nextLevelOf,
  progressToNext,
  type CoinsBalance,
  type VipLevel,
} from "@/lib/wina-coins";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/wina-coins")({
  head: () => ({
    meta: [
      { title: "Wina Coins — Programme de fidélité premium" },
      { name: "description", content: "Gagnez des Wina Coins à chaque réservation et débloquez des avantages VIP exclusifs." },
    ],
  }),
  component: WinaCoinsPage,
});

interface HistoryRow {
  id: string;
  reservation_type: string | null;
  amount_paid: number;
  coins_earned: number;
  bonus_percentage: number;
  operation_type: "earn" | "spend" | "refund" | "admin_adjust";
  status: string;
  note: string | null;
  created_at: string;
}

function WinaCoinsPage() {
  const { user, isLoading } = useAuth();
  const [balance, setBalance] = useState<CoinsBalance | null>(null);
  const [levels, setLevels] = useState<VipLevel[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !user) return;
    let mounted = true;
    (async () => {
      const [b, lv, h] = await Promise.all([
        fetchBalance(user.id),
        fetchLevels(),
        supabase
          .from("wina_coins_history")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (!mounted) return;
      setBalance(b);
      setLevels(lv);
      setHistory((h.data || []) as HistoryRow[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`coins-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wina_coins_history", filter: `user_id=eq.${user.id}` },
        async () => {
          const [b, h] = await Promise.all([
            fetchBalance(user.id),
            supabase
              .from("wina_coins_history")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(50),
          ]);
          if (!mounted) return;
          setBalance(b);
          setHistory((h.data || []) as HistoryRow[]);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Connectez-vous pour accéder à vos Wina Coins.</p>
      </div>
    );
  }

  const totalEarned = balance?.total_coins_earned ?? 0;
  const currentLevel = levelOf(totalEarned, levels);
  const next = nextLevelOf(totalEarned, levels);
  const progress = progressToNext(totalEarned, levels);

  const earned = history.filter((h) => h.operation_type === "earn" && h.status === "completed");
  const spent = history.filter((h) => h.operation_type === "spend");
  const totalSavings = spent.reduce((s, h) => s + Math.abs(h.coins_earned), 0);

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <div className="bg-[image:var(--gradient-wina-premium)] px-4 pb-10 pt-6 text-white">
        <Link to="/mon-compte" className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Wina Coins</h1>
        <p className="text-sm text-white/70">Votre fidélité, vos récompenses premium.</p>
      </div>

      <div className="mx-auto -mt-8 max-w-md space-y-4 px-4">
        {loading ? (
          <div className="h-44 animate-pulse rounded-3xl bg-muted" />
        ) : (
          <CoinsBalanceCard
            balance={balance?.coins_balance ?? 0}
            totalEarned={totalEarned}
            level={currentLevel}
            nextLevel={next}
            progress={progress}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={TrendingUp} label="Gagnés" value={formatCoins(totalEarned)} />
          <StatCard icon={Gift} label="Économies" value={formatXAF(totalSavings)} />
          <StatCard icon={Sparkles} label="Réservations" value={String(balance?.total_reservations ?? 0)} />
        </div>

        {/* Avantages */}
        {currentLevel && currentLevel.benefits.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <VipBadge level={currentLevel.level_name} size="sm" />
              <h2 className="text-sm font-bold">Avantages {currentLevel.level_name}</h2>
            </div>
            <ul className="mt-3 space-y-2">
              {currentLevel.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* Paliers */}
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Tous les paliers</h2>
          <div className="space-y-2">
            {levels.map((l) => {
              const reached = totalEarned >= l.min_coins;
              const isCurrent = currentLevel?.id === l.id;
              return (
                <div
                  key={l.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    isCurrent ? "border-primary bg-primary/5" : reached ? "" : "opacity-50"
                  }`}
                >
                  <VipBadge level={l.level_name} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{l.level_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Dès {formatCoins(l.min_coins)} coins · +{l.bonus_percentage}% bonus
                    </p>
                  </div>
                  {isCurrent && <span className="text-[10px] font-bold uppercase text-primary">Actuel</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Historique */}
        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Historique</h2>
          </div>
          <Tabs defaultValue="earn">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="earn">Gains ({earned.length})</TabsTrigger>
              <TabsTrigger value="spend">Utilisations ({spent.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="earn" className="mt-3 space-y-2">
              {earned.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Aucun gain pour le moment. Réservez pour cumuler vos premiers coins !
                </p>
              ) : (
                earned.map((h) => <HistoryItem key={h.id} row={h} />)
              )}
            </TabsContent>
            <TabsContent value="spend" className="mt-3 space-y-2">
              {spent.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Vous n'avez utilisé aucun coin pour le moment.
                </p>
              ) : (
                spent.map((h) => <HistoryItem key={h.id} row={h} />)
              )}
            </TabsContent>
          </Tabs>
        </section>

        <p className="px-2 text-center text-[10px] text-muted-foreground">
          1 000 FCFA dépensés = 10 Wina Coins. Crédités après validation de votre paiement par l'admin.
        </p>
      </div>
      <ClientNav />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 text-xs font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

const SERVICE_LABEL: Record<string, string> = {
  VTC: "VTC",
  TRANSPORT_SCOLAIRE: "Scolaire",
  LOCATION_BUS: "Location bus",
  CIRCUIT_TOURISTIQUE: "Tourisme",
  BILLET: "Billet",
};

function HistoryItem({ row }: { row: HistoryRow }) {
  const positive = row.coins_earned >= 0;
  const label =
    row.operation_type === "earn"
      ? "Gain"
      : row.operation_type === "spend"
        ? "Réduction"
        : row.operation_type === "refund"
          ? "Remboursement"
          : "Ajustement admin";
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {label}
          {row.reservation_type ? ` · ${SERVICE_LABEL[row.reservation_type] || row.reservation_type}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          {row.bonus_percentage > 0 ? ` · bonus +${row.bonus_percentage}%` : ""}
          {row.note ? ` · ${row.note}` : ""}
        </p>
      </div>
      <span className={`text-sm font-bold ${positive ? "text-success" : "text-destructive"}`}>
        {positive ? "+" : ""}
        {formatCoins(row.coins_earned)}
      </span>
    </div>
  );
}
