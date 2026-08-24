import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Wallet, TrendingUp, Receipt, Loader2, Percent, ArrowDownToLine, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericTextField } from "@/components/ui/numeric-text-field";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { appToast } from "@/lib/app-toast";
import { SupportContact } from "@/components/SupportContact";
import {
  fetchDriverWallet, fetchDriverTransactions, fetchDriverWithdrawals, requestWithdrawal,
  fmtXAF, MIN_WITHDRAWAL, isValidDepositNumber,
  WITHDRAWAL_METHOD_LABEL, WITHDRAWAL_STATUS_LABEL,
  type DriverWallet, type DriverTx, type DriverWithdrawal,
} from "@/lib/driver-wallet";

export const Route = createFileRoute("/chauffeur/gains")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mon portefeuille — Chauffeur WINA TOUR" },
      { name: "description", content: "Solde, historique des gains et demandes de retrait du chauffeur." },
    ],
  }),
  component: ChauffeurGainsPage,
});

function ChauffeurGainsPage() {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [txs, setTxs] = useState<DriverTx[]>([]);
  const [withdrawals, setWithdrawals] = useState<DriverWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [depositNumber, setDepositNumber] = useState("");
  const [method, setMethod] = useState("airtel_money");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.add("dark");
    return () => { if (!had) root.classList.remove("dark"); };
  }, []);

  useEffect(() => {
    if (!isLoading && (!user || (role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, user, role, navigate]);

  const reload = useCallback(async (uid: string) => {
    const [w, t, wd] = await Promise.all([
      fetchDriverWallet(uid),
      fetchDriverTransactions(uid),
      fetchDriverWithdrawals(uid),
    ]);
    setWallet(w);
    setTxs(t);
    setWithdrawals(wd);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: number | undefined;

    (async () => {
      setLoading(true);
      try { await reload(user.id); } catch (err) { if (!cancelled) appToast.fromError(err); }
      if (!cancelled) setLoading(false);
    })();

    const debouncedReload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (!cancelled) reload(user.id).catch(() => {}); }, 700);
    };

    const ch = supabase
      .channel(`driver-wallet-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_wallet_transactions", filter: `driver_id=eq.${user.id}` }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_withdrawals", filter: `driver_id=eq.${user.id}` }, debouncedReload)
      .subscribe();

    return () => { cancelled = true; window.clearTimeout(timer); supabase.removeChannel(ch); };
  }, [user, reload]);

  const pendingTotal = withdrawals.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0);
  const available = Math.max(0, (wallet?.balance_earnings ?? 0) - pendingTotal);

  const submitWithdrawal = async () => {
    if (submitting) return;
    const value = amount ?? 0;
    if (value < MIN_WITHDRAWAL) {
      appToast.warning("Montant trop faible", `Le retrait minimum est de ${fmtXAF(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (value > available) {
      appToast.warning("Solde insuffisant", `Vous pouvez retirer au maximum ${fmtXAF(available)}.`);
      return;
    }
    if (!isValidDepositNumber(depositNumber)) {
      appToast.warning("Numéro invalide", "Saisissez le numéro sur lequel vous souhaitez être payé.");
      return;
    }
    setSubmitting(true);
    try {
      await requestWithdrawal({ amount: value, depositNumber, method });
      appToast.success(
        "Demande de retrait envoyée",
        `${fmtXAF(value)} — un administrateur validera votre paiement sous peu.`,
      );
      setOpen(false);
      setAmount(null);
      setDepositNumber("");
      if (user) await reload(user.id);
    } catch (err) {
      appToast.fromError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link to="/chauffeur"><Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Mon portefeuille</h1>
            <p className="text-xs text-muted-foreground">Gains, retraits et historique · commission 20%</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <section className="rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/0 p-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary/80">
                <Wallet className="h-4 w-4" /> Solde disponible
              </div>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-primary">{fmtXAF(available)}</p>
              {pendingTotal > 0 && (
                <p className="mt-1 text-xs text-amber-500">
                  {fmtXAF(pendingTotal)} en attente de validation administrateur
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Crédité automatiquement à chaque course terminée (80% du montant brut).
              </p>

              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button className="mt-4 h-12 w-full rounded-2xl text-base font-semibold" disabled={available < MIN_WITHDRAWAL}>
                    <ArrowDownToLine className="mr-2 h-5 w-5" />
                    Demander un retrait
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-3xl">
                  <SheetHeader className="text-left">
                    <SheetTitle>Retirer mes gains</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-4 pb-6">
                    <div className="rounded-2xl bg-muted/40 p-3 text-sm">
                      Disponible : <span className="font-bold text-primary">{fmtXAF(available)}</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="wd-amount">Montant à retirer (FCFA)</Label>
                      <NumericTextField
                        id="wd-amount"
                        value={amount}
                        onValueChange={setAmount}
                        min={0}
                        placeholder={`Minimum ${MIN_WITHDRAWAL}`}
                        className="h-12 text-base"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Moyen de réception</Label>
                      <Select value={method} onValueChange={setMethod}>
                        <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(WITHDRAWAL_METHOD_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="wd-number">Numéro de dépôt</Label>
                      <Input
                        id="wd-number"
                        inputMode="tel"
                        value={depositNumber}
                        onChange={(e) => setDepositNumber(e.target.value)}
                        placeholder="Ex. 066 26 48 90"
                        className="h-12 text-base"
                      />
                      <p className="text-xs text-muted-foreground">
                        Le compte qui recevra le paiement. Vérifiez-le attentivement.
                      </p>
                    </div>

                    <Button onClick={submitWithdrawal} disabled={submitting} className="h-12 w-full rounded-2xl text-base font-semibold">
                      {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Envoi…</> : "Confirmer la demande"}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Total gagné</div>
                <p className="mt-1 text-xl font-bold">{fmtXAF(wallet?.total_earned ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Percent className="h-3.5 w-3.5" /> Commission</div>
                <p className="mt-1 text-xl font-bold">{fmtXAF(wallet?.total_commission_paid ?? 0)}</p>
              </div>
            </div>

            {withdrawals.length > 0 && (
              <section className="rounded-3xl border border-border bg-card">
                <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <ArrowDownToLine className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold">Mes retraits</h2>
                </header>
                <ul className="divide-y divide-border">
                  {withdrawals.map((w) => (
                    <li key={w.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{fmtXAF(w.amount)}</span>
                          <Badge
                            variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {w.status === "pending" && <Clock3 className="mr-1 h-3 w-3" />}
                            {w.status === "paid" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                            {w.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                            {WITHDRAWAL_STATUS_LABEL[w.status]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {WITHDRAWAL_METHOD_LABEL[w.method] ?? w.method} · {w.deposit_number} ·{" "}
                          {new Date(w.created_at).toLocaleDateString("fr-FR", { dateStyle: "short" })}
                        </p>
                        {w.admin_note && <p className="mt-0.5 text-[11px] text-amber-500">{w.admin_note}</p>}
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-muted-foreground">{w.reference}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-3xl border border-border bg-card">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Receipt className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Historique</h2>
                <span className="ml-auto text-xs text-muted-foreground">{txs.length} opération{txs.length > 1 ? "s" : ""}</span>
              </header>
              {txs.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Aucun gain pour le moment. Vos courses terminées apparaîtront ici.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {txs.map((tx) => {
                    const isWithdrawal = tx.kind === "withdrawal";
                    return (
                      <li key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {isWithdrawal ? "Retrait" : tx.payment_method}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(tx.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </div>
                          {tx.note && <p className="mt-1 truncate text-xs text-muted-foreground">{tx.note}</p>}
                          {!isWithdrawal && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Brut {fmtXAF(tx.gross_amount)} − Commission {fmtXAF(tx.platform_fee)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{isWithdrawal ? "Débit" : "Net"}</p>
                          <p className={`text-base font-bold ${isWithdrawal ? "text-muted-foreground" : "text-success"}`}>
                            {isWithdrawal ? "−" : "+"}{fmtXAF(tx.net_amount)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <SupportContact />
          </>
        )}
      </main>
    </div>
  );
}
