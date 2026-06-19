import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, RefreshCw, Loader2, History, Zap } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchVtcWallet, fetchVtcTransactions, fetchVtcRecharges,
  formatPoints, formatXAF, RECHARGE_METHOD_LABEL,
  type VtcWallet, type VtcWalletTx, type VtcRechargeRequest,
} from "@/lib/vtc-wallet";


export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Mon Wallet VTC Points — Winatour" },
      { name: "description", content: "Solde, recharges et historique de votre portefeuille VTC Points." },
    ],
  }),
  component: WalletPage,
});

const QUICK_AMOUNTS = [2000, 5000, 10000, 20000, 50000];

function WalletPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [wallet, setWallet] = useState<VtcWallet | null>(null);
  const [txs, setTxs] = useState<VtcWalletTx[]>([]);
  const [recharges, setRecharges] = useState<VtcRechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tx" | "recharges">("tx");
  

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/connexion" });
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [w, t, r] = await Promise.all([
      fetchVtcWallet(user.id),
      fetchVtcTransactions(user.id),
      fetchVtcRecharges(user.id),
    ]);
    setWallet(w);
    setTxs(t);
    setRecharges(r);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (location.pathname.startsWith("/wallet/recharger")) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mon Wallet</h1>
            <p className="text-sm text-muted-foreground">VTC Points pour courses & covoiturage</p>
          </div>
          <Button variant="ghost" size="icon" onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </header>

        {/* Balance card */}
        <Card className="overflow-hidden border-0 bg-[image:var(--gradient-primary)] text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs opacity-80">
              <Wallet className="h-3.5 w-3.5" /> Solde disponible
            </div>
            <p className="mt-2 text-4xl font-bold tracking-tight">
              {formatPoints(wallet?.balance_points ?? 0)}
              <span className="ml-2 text-base font-medium opacity-80">VTC Points</span>
            </p>
            <p className="mt-1 text-xs opacity-80">≈ {formatXAF(wallet?.balance_points ?? 0)}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
                <p className="opacity-80">Total rechargé</p>
                <p className="mt-0.5 text-lg font-semibold">{formatPoints(wallet?.total_recharged ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
                <p className="opacity-80">Total dépensé</p>
                <p className="mt-0.5 text-lg font-semibold">{formatPoints(wallet?.total_spent ?? 0)}</p>
              </div>
            </div>

            <Button
              type="button"
              className="mt-5 w-full bg-white text-primary hover:bg-white/90"
              size="lg"
              onClick={() => navigate({ to: "/wallet/recharger" })}
            >
              <Plus className="h-4 w-4" /> Recharger mon portefeuille
            </Button>

          </CardContent>
        </Card>

        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs">
          <Zap className="h-4 w-4 text-accent" />
          <p>Paiement <strong>instantané</strong> pour VTC et covoiturage — débit auto à la commande.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button variant={tab === "tx" ? "default" : "outline"} size="sm" onClick={() => setTab("tx")} className="flex-1">
            <History className="h-3.5 w-3.5" /> Transactions
          </Button>
          <Button variant={tab === "recharges" ? "default" : "outline"} size="sm" onClick={() => setTab("recharges")} className="flex-1">
            <ArrowDownCircle className="h-3.5 w-3.5" /> Recharges
          </Button>
        </div>

        {tab === "tx" ? <TxList txs={txs} loading={loading} /> : <RechargeList items={recharges} loading={loading} />}
      </div>

      <ClientNav />
    </div>
  );
}

function TxList({ txs, loading }: { txs: VtcWalletTx[]; loading: boolean }) {
  if (loading) return <p className="text-center text-sm text-muted-foreground py-8">Chargement…</p>;
  if (!txs.length) return (
    <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
      Aucune transaction pour le moment.
    </CardContent></Card>
  );
  return (
    <div className="space-y-2">
      {txs.map((t) => {
        const positive = t.amount_points > 0;
        const label = t.type === "recharge" ? "Recharge"
          : t.type === "trip_payment" ? "Paiement course"
          : t.type === "refund" ? "Remboursement"
          : "Ajustement admin";
        return (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {positive ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("fr-FR")}
                    {t.reference_code ? ` · ${t.reference_code}` : ""}
                  </p>
                  {t.note && <p className="text-[11px] text-muted-foreground italic">{t.note}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                  {positive ? "+" : ""}{formatPoints(t.amount_points)}
                </p>
                <p className="text-[10px] text-muted-foreground">Solde: {formatPoints(t.balance_after)}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RechargeList({ items, loading }: { items: VtcRechargeRequest[]; loading: boolean }) {
  if (loading) return <p className="text-center text-sm text-muted-foreground py-8">Chargement…</p>;
  if (!items.length) return (
    <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
      Aucune demande de recharge.
    </CardContent></Card>
  );
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{formatPoints(r.amount_points)} points</p>
                <p className="text-[11px] text-muted-foreground">
                  {RECHARGE_METHOD_LABEL[r.payment_method]} · Réf: {r.payment_reference}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
              <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                {r.status === "approved" ? "Validée" : r.status === "rejected" ? "Rejetée" : "En attente"}
              </Badge>
            </div>
            {r.admin_note && (
              <p className="mt-2 rounded-md bg-muted/50 p-2 text-[11px] italic text-muted-foreground">
                Admin : {r.admin_note}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

