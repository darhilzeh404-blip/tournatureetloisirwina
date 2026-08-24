import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Loader2, CheckCircle2, XCircle, Clock3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { appToast } from "@/lib/app-toast";
import {
  fetchAllWithdrawals, decideWithdrawal, fmtXAF,
  WITHDRAWAL_METHOD_LABEL, WITHDRAWAL_STATUS_LABEL, type DriverWithdrawal,
} from "@/lib/driver-wallet";

export const Route = createFileRoute("/admin/retraits")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Retraits chauffeurs — Admin WINA TOUR" },
      { name: "description", content: "Validation des demandes de retrait des chauffeurs VTC." },
    ],
  }),
  component: AdminWithdrawalsPage,
});

function AdminWithdrawalsPage() {
  const [items, setItems] = useState<DriverWithdrawal[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ wd: DriverWithdrawal; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (st: string) => {
    setLoading(true);
    try {
      const rows = await fetchAllWithdrawals(st);
      setItems(rows);
      const ids = [...new Set(rows.map((r) => r.driver_id))];
      if (ids.length) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", ids);
        const map: Record<string, string> = {};
        (data ?? []).forEach((p: { user_id: string; full_name: string | null; phone: string | null }) => {
          map[p.user_id] = p.full_name || p.phone || "Chauffeur";
        });
        setNames(map);
      }
    } catch (err) {
      appToast.fromError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status); }, [status, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((w) =>
      (names[w.driver_id] ?? "").toLowerCase().includes(q) ||
      w.reference.toLowerCase().includes(q) ||
      w.deposit_number.includes(q),
    );
  }, [items, query, names]);

  const pendingTotal = items.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);

  const confirm = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await decideWithdrawal(target.wd.id, target.approve, note || undefined);
      appToast.success(
        target.approve ? "Retrait validé" : "Retrait refusé",
        `${fmtXAF(target.wd.amount)} — ${names[target.wd.driver_id] ?? "chauffeur"} a été notifié.`,
      );
      setTarget(null);
      setNote("");
      await load(status);
    } catch (err) {
      appToast.fromError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
          <ArrowDownToLine className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Retraits chauffeurs</h1>
          <p className="text-sm text-muted-foreground">
            Validez les demandes de retrait. Le débit du portefeuille est automatique et non rejouable.
          </p>
        </div>
        {status === "pending" && pendingTotal > 0 && (
          <Badge variant="secondary" className="text-sm">{fmtXAF(pendingTotal)} en attente</Badge>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="pending">En attente</TabsTrigger>
            <TabsTrigger value="paid">Payés</TabsTrigger>
            <TabsTrigger value="rejected">Refusés</TabsTrigger>
            <TabsTrigger value="all">Tous</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chauffeur, référence, numéro…"
            className="h-11 pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Aucune demande de retrait dans cette catégorie.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((w) => (
            <li key={w.id} className="rounded-3xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{names[w.driver_id] ?? "Chauffeur"}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{w.reference}</p>
                </div>
                <Badge
                  variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}
                  className="shrink-0 text-[10px]"
                >
                  {w.status === "pending" && <Clock3 className="mr-1 h-3 w-3" />}
                  {w.status === "paid" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                  {w.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                  {WITHDRAWAL_STATUS_LABEL[w.status]}
                </Badge>
              </div>

              <p className="mt-3 text-2xl font-extrabold tracking-tight text-primary">{fmtXAF(w.amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {WITHDRAWAL_METHOD_LABEL[w.method] ?? w.method} · <span className="font-medium text-foreground">{w.deposit_number}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Demandé le {new Date(w.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
              </p>
              {w.admin_note && <p className="mt-1 text-[11px] text-amber-500">{w.admin_note}</p>}

              {w.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <Button className="h-10 flex-1 rounded-xl" onClick={() => { setTarget({ wd: w, approve: true }); setNote(""); }}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Valider
                  </Button>
                  <Button variant="outline" className="h-10 flex-1 rounded-xl" onClick={() => { setTarget({ wd: w, approve: false }); setNote(""); }}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Refuser
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{target?.approve ? "Valider le retrait" : "Refuser le retrait"}</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  {fmtXAF(target.wd.amount)} vers <strong>{target.wd.deposit_number}</strong> (
                  {WITHDRAWAL_METHOD_LABEL[target.wd.method] ?? target.wd.method}).{" "}
                  {target.approve
                    ? "Le portefeuille du chauffeur sera débité immédiatement."
                    : "Aucun débit ne sera effectué."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={target?.approve ? "Note (référence du dépôt effectué)…" : "Motif du refus (visible par le chauffeur)…"}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>Annuler</Button>
            <Button onClick={confirm} disabled={busy} variant={target?.approve ? "default" : "destructive"}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traitement…</> : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
