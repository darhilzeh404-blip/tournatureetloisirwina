import { supabase } from "@/integrations/supabase/client";

export interface VipLevel {
  id: string;
  level_name: string;
  min_coins: number;
  bonus_percentage: number;
  badge_icon: string;
  benefits: string[];
  sort_order: number;
}

export interface CoinsBalance {
  user_id: string;
  coins_balance: number;
  total_coins_earned: number;
  total_reservations: number;
  vip_level_id: string | null;
}

export const COINS_PER_FCFA = 10 / 1000; // 1000 FCFA = 10 coins
export const FCFA_PER_COIN = 1; // 1 coin = 1 FCFA en réduction

export function formatCoins(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function formatXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

export function tierColor(name: string | null | undefined): string {
  switch ((name || "").toLowerCase()) {
    case "gold":
      return "var(--wina-gold)";
    case "platinum":
      return "var(--wina-platinum)";
    case "diamond":
      return "var(--wina-diamond)";
    case "diamond+":
      return "var(--wina-diamond-plus)";
    default:
      return "var(--wina-silver)";
  }
}

export function tierGradient(name: string | null | undefined): string {
  switch ((name || "").toLowerCase()) {
    case "gold":
      return "linear-gradient(135deg, #b8860b, #ffd700, #b8860b)";
    case "platinum":
      return "linear-gradient(135deg, #6c7a89, #e5e7eb, #94a3b8)";
    case "diamond":
      return "linear-gradient(135deg, #4f46e5, #22d3ee, #67e8f9)";
    case "diamond+":
      return "linear-gradient(135deg, #0f172a, #6366f1, #a855f7, #ec4899)";
    default:
      return "linear-gradient(135deg, #94a3b8, #cbd5e1, #64748b)";
  }
}

export async function fetchBalance(userId: string): Promise<CoinsBalance | null> {
  const { data, error } = await supabase
    .from("wina_coin_balances")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[wina-coins] fetchBalance", error);
    return null;
  }
  if (!data) {
    return {
      user_id: userId,
      coins_balance: 0,
      total_coins_earned: 0,
      total_reservations: 0,
      vip_level_id: null,
    };
  }
  return data as CoinsBalance;
}

export async function fetchLevels(): Promise<VipLevel[]> {
  const { data, error } = await supabase
    .from("vip_levels")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[wina-coins] fetchLevels", error);
    return [];
  }
  return (data || []).map((l) => ({
    ...(l as VipLevel),
    benefits: Array.isArray(l.benefits) ? (l.benefits as string[]) : [],
  }));
}

export function levelOf(totalEarned: number, levels: VipLevel[]): VipLevel | null {
  if (!levels.length) return null;
  const sorted = [...levels].sort((a, b) => a.min_coins - b.min_coins);
  let current = sorted[0];
  for (const l of sorted) if (totalEarned >= l.min_coins) current = l;
  return current;
}

export function nextLevelOf(totalEarned: number, levels: VipLevel[]): VipLevel | null {
  const sorted = [...levels].sort((a, b) => a.min_coins - b.min_coins);
  return sorted.find((l) => l.min_coins > totalEarned) ?? null;
}

export function progressToNext(totalEarned: number, levels: VipLevel[]): number {
  const current = levelOf(totalEarned, levels);
  const next = nextLevelOf(totalEarned, levels);
  if (!next || !current) return 100;
  const span = next.min_coins - current.min_coins;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((totalEarned - current.min_coins) / span) * 100));
}
