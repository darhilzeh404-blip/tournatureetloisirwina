import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Wallet, TrendingUp, Receipt, Loader2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/chauffeur/gains")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/connexion" });
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", session.user.id).limit(1).single();
    if (roleRow?.role !== "chauffeur" && roleRow?.role !== "admin") throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Mes gains — Chauffeur" },
      { name: "description", content: "Solde et historique des gains chauffeur, commission 20% retenue." },
    ],
  }),
  component: ChauffeurGainsPage,
});

interface Wallet {
  balance_earnings: number;
  total_earned: number;
  total_commission_paid: number;
}

interface Tx {
  id: string;
  created_at: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  payment_method: string;
  trip_id: string | null;
  reservation_id: string | null;
  note: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

function ChauffeurGainsPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.add("dark");
    return () => { if (!had) root.classList.remove("dark"); };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: w }, { data: t }] = await Promise.all([
        supabase.from("driver_wallets").select("balance_earnings, total_earned, total_commission_paid").eq("driver_id", user.id).maybeSingle(),
        supabase.from("driver_wallet_transactions")
          .select("id, created_at, gross_amount, net_amount, platform_fee, payment_method, trip_id, reservation_id, note")
          .eq("driver_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (cancelled) return;
      setWallet((w as Wallet) ?? { balance_earnings: 0, total_earned: 0, total_commission_paid: 0 });
      setTxs((t as Tx[]) ?? []);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`driver-wallet-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_wallet_transactions", filter: `driver_id=eq.${user.id}` }, async () => {
        const [{ data: w }, { data: t }] = await Promise.all([
          supabase.from("driver_wallets").select("balance_earnings, total_earned, total_commission_paid").eq("driver_id", user.id).maybeSingle(),
          supabase.from("driver_wallet_transactions")
            .select("id, created_at, gross_amount, net_amount, platform_fee, payment_method, trip_id, reservation_id, note")
            .eq("driver_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
        setWallet((w as Wallet) ?? null);
        setTxs((t as Tx[]) ?? []);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link to="/chauffeur"><Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Mes gains</h1>
            <p className="text-xs text-muted-foreground">Solde et historique · commission plateforme 20%</p>
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
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-primary">{fmt(wallet?.balance_earnings ?? 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Crédité automatiquement à chaque course terminée (80% du montant brut).
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Total gagné</div>
                <p className="mt-1 text-xl font-bold">{fmt(wallet?.total_earned ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Percent className="h-3.5 w-3.5" /> Commission</div>
                <p className="mt-1 text-xl font-bold">{fmt(wallet?.total_commission_paid ?? 0)}</p>
              </div>
            </div>

            <section className="rounded-3xl border border-border bg-card">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Receipt className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Historique des courses</h2>
                <span className="ml-auto text-xs text-muted-foreground">{txs.length} dernière{txs.length > 1 ? "s" : ""}</span>
              </header>
              {txs.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Aucun gain pour le moment. Vos courses terminées apparaîtront ici.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {txs.map((tx) => (
                    <li key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{tx.payment_method}</Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                        {tx.note && <p className="mt-1 truncate text-xs text-muted-foreground">{tx.note}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Brut {fmt(tx.gross_amount)} − Commission {fmt(tx.platform_fee)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Net</p>
                        <p className="text-base font-bold text-success">+{fmt(tx.net_amount)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
