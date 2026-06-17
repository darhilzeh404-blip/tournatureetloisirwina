import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  const [wallet, setWallet] = useState<VtcWallet | null>(null);
  const [txs, setTxs] = useState<VtcWalletTx[]>([]);
  const [recharges, setRecharges] = useState<VtcRechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tx" | "recharges">("tx");
  const [open, setOpen] = useState(false);

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

            <Button asChild className="mt-5 w-full bg-white text-primary hover:bg-white/90" size="lg">
              <Link to="/wallet/recharger">
                <Plus className="h-4 w-4" /> Recharger mon portefeuille
              </Link>
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

function RechargeDialog({
  children, open, onOpenChange, onSuccess,
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState<number>(5000);
  const [method, setMethod] = useState<VtcRechargeRequest["payment_method"]>("mobile_money");
  const [ref, setRef] = useState("");
  const [agent, setAgent] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (amount <= 0) return toast.error("Montant invalide");
    if (!ref.trim()) return toast.error("Référence de paiement requise");
    if (!agent.trim()) return toast.error("Code agent Winatour requis");
    setSubmitting(true);
    try {
      await requestRecharge({
        amountPoints: amount,
        method,
        paymentReference: ref.trim(),
        agentCode: agent.trim(),
        clientNote: note.trim() || undefined,
      });
      toast.success("Demande envoyée ! En attente de validation admin.");
      setRef(""); setAgent(""); setNote(""); setAmount(5000);
      onOpenChange(false);
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Recharger mon wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Montant (1 point = 1 FCFA)</Label>
            <Input
              type="number"
              min={500}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-1 text-lg font-bold"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    amount === a ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  {formatPoints(a)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Méthode de paiement</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RECHARGE_METHOD_LABEL) as Array<keyof typeof RECHARGE_METHOD_LABEL>).map((k) => (
                  <SelectItem key={k} value={k}>{RECHARGE_METHOD_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Référence du paiement</Label>
            <Input
              placeholder="Ex: numéro transaction Airtel/Moov"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Code agent Winatour</Label>
            <Input
              placeholder="Code fourni par l'agent"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Note (optionnel)</Label>
            <Input
              placeholder="Précisions pour l'admin"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>

          <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
            Votre demande sera validée par un administrateur après vérification du paiement.
            Les points seront crédités dès validation.
          </p>

          <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer la demande"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
