import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet, TrendingUp, Percent, Users, Receipt, Search } from "lucide-react";

export const Route = createFileRoute("/admin/vtc-wallets")({
  head: () => ({ meta: [{ title: "Portefeuilles VTC — Admin" }] }),
  component: AdminVtcWalletsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

interface DriverWallet {
  driver_id: string;
  balance_earnings: number;
  total_earned: number;
  total_commission_paid: number;
  full_name?: string;
  category?: string | null;
}

interface Tx {
  id: string;
  driver_id: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  payment_method: string;
  created_at: string;
  trip_id: string | null;
  driver_name?: string;
}

function AdminVtcWalletsPage() {
  const [wallets, setWallets] = useState<DriverWallet[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: walletsData }, { data: txData }] = await Promise.all([
      supabase.from("driver_wallets").select("*").order("balance_earnings", { ascending: false }).limit(300),
      supabase
        .from("driver_wallet_transactions")
        .select("id, driver_id, gross_amount, net_amount, platform_fee, payment_method, created_at, trip_id")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const wl = (walletsData ?? []) as DriverWallet[];
    const tl = (txData ?? []) as Tx[];
    const driverIds = Array.from(new Set([...wl.map((w) => w.driver_id), ...tl.map((t) => t.driver_id)]));

    if (driverIds.length) {
      const [{ data: profs }, { data: drs }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", driverIds),
        supabase.from("drivers").select("user_id, category").in("user_id", driverIds),
      ]);
      const nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.full_name]));
      const catMap = new Map((drs ?? []).map((d) => [d.user_id, d.category as string | null]));
      wl.forEach((w) => {
        w.full_name = nameMap.get(w.driver_id) ?? "Chauffeur";
        w.category = catMap.get(w.driver_id) ?? null;
      });
      tl.forEach((t) => {
        t.driver_name = nameMap.get(t.driver_id) ?? "Chauffeur";
      });
    }

    setWallets(wl);
    setTxs(tl);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-vtc-wallets")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_wallet_transactions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_wallets" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const stats = useMemo(() => {
    const totalCommission = wallets.reduce((s, w) => s + (w.total_commission_paid || 0), 0);
    const totalEarned = wallets.reduce((s, w) => s + (w.total_earned || 0), 0);
    const totalBalance = wallets.reduce((s, w) => s + (w.balance_earnings || 0), 0);
    return { totalCommission, totalEarned, totalBalance, driverCount: wallets.length };
  }, [wallets]);

  const filteredWallets = wallets.filter((w) =>
    (w.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" /> Portefeuilles VTC — Chauffeurs & plateforme
        </h1>
        <p className="text-sm text-muted-foreground">
          Suivi des gains chauffeurs (80%) et de la commission plateforme (20%) sur les courses VTC réglées via portefeuille.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Percent className="h-3.5 w-3.5" /> Commission plateforme
            </p>
            <p className="mt-1 text-2xl font-bold text-primary">{fmt(stats.totalCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Total versé aux chauffeurs
            </p>
            <p className="mt-1 text-2xl font-bold">{fmt(stats.totalEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Solde total en portefeuille
            </p>
            <p className="mt-1 text-2xl font-bold">{fmt(stats.totalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Chauffeurs actifs
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.driverCount}</p>
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Portefeuilles chauffeurs ({filteredWallets.length})
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un chauffeur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filteredWallets.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucun portefeuille chauffeur pour le moment.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredWallets.map((w) => (
              <Card key={w.driver_id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{w.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.category ? <Badge variant="secondary" className="text-[10px]">{w.category}</Badge> : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Solde</p>
                      <p className="text-lg font-bold text-success">{fmt(w.balance_earnings)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                      <p className="text-muted-foreground">Total gagné</p>
                      <p className="font-semibold">{fmt(w.total_earned)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                      <p className="text-muted-foreground">Commission versée</p>
                      <p className="font-semibold">{fmt(w.total_commission_paid)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Dernières transactions ({txs.length})
        </h2>
        {loading ? null : txs.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune transaction pour le moment.
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.driver_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("fr-FR")} · {t.payment_method}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Brut {fmt(t.gross_amount)}</p>
                      <p className="text-xs text-primary">Commission {fmt(t.platform_fee)}</p>
                      <p className="text-sm font-bold text-success">Net +{fmt(t.net_amount)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
