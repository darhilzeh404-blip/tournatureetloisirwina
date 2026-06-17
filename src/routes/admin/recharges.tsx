import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, CheckCircle2, XCircle, Search, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  formatPoints, RECHARGE_METHOD_LABEL, adminValidateRecharge,
  type VtcRechargeRequest,
} from "@/lib/vtc-wallet";

export const Route = createFileRoute("/admin/recharges")({
  component: AdminRechargesPage,
});

interface RowWithUser extends VtcRechargeRequest {
  user_full_name?: string | null;
  user_email?: string | null;
}

function AdminRechargesPage() {
  const [rows, setRows] = useState<RowWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [target, setTarget] = useState<{ row: RowWithUser; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("vtc_recharge_requests" as never).select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data } = await q;
    const list = (data ?? []) as unknown as RowWithUser[];

    if (list.length) {
      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      const m = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      list.forEach((r) => {
        const p = m.get(r.user_id);
        r.user_full_name = p?.full_name ?? null;
        r.user_email = p?.email ?? null;
      });
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filter]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.user_full_name ?? "").toLowerCase().includes(q) ||
      (r.user_email ?? "").toLowerCase().includes(q) ||
      (r.payment_reference ?? "").toLowerCase().includes(q) ||
      (r.agent_code ?? "").toLowerCase().includes(q)
    );
  });

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const totalPending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount_points, 0);

  const submit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await adminValidateRecharge(target.row.id, target.approve, note.trim() || undefined);
      toast.success(target.approve ? "Recharge validée et points crédités" : "Recharge rejetée");
      setTarget(null);
      setNote("");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Recharges portefeuille
        </h1>
        <p className="text-sm text-muted-foreground">Validation des demandes de recharge du portefeuille Wina.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">En attente</p>
            <p className="mt-1 text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Volume en attente</p>
            <p className="mt-1 text-2xl font-bold">{formatPoints(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Total recharges</p>
            <p className="mt-1 text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher client, réf, code agent…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>
            En attente
          </Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Toutes
          </Button>
          <Button variant="ghost" size="icon" onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-3">Date</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Méthode</th>
                    <th className="p-3">Référence</th>
                    <th className="p-3">Code agent</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("fr-FR")}
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{r.user_full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.user_email}</p>
                      </td>
                      <td className="p-3 text-xs">{RECHARGE_METHOD_LABEL[r.payment_method]}</td>
                      <td className="p-3 font-mono text-xs">{r.payment_reference}</td>
                      <td className="p-3 font-mono text-xs">{r.agent_code}</td>
                      <td className="p-3 text-right font-bold">{formatPoints(r.amount_points)}</td>
                      <td className="p-3">
                        <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                          {r.status === "approved" ? "Validée" : r.status === "rejected" ? "Rejetée" : "En attente"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        {r.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-emerald-600" onClick={() => setTarget({ row: r, approve: true })}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Valider
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-rose-600" onClick={() => setTarget({ row: r, approve: false })}>
                              <XCircle className="h-3.5 w-3.5" /> Rejeter
                            </Button>
                          </div>
                        ) : (
                          r.admin_note && <span className="text-xs italic text-muted-foreground">{r.admin_note}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">Aucune demande.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{target?.approve ? "Valider la recharge" : "Rejeter la recharge"}</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p><strong>{target.row.user_full_name || target.row.user_email}</strong></p>
                <p className="text-xs text-muted-foreground">
                  {formatPoints(target.row.amount_points)} points · {RECHARGE_METHOD_LABEL[target.row.payment_method]}
                </p>
                <p className="text-xs text-muted-foreground">Réf : {target.row.payment_reference} · Agent : {target.row.agent_code}</p>
              </div>
              <div>
                <label className="text-xs font-medium">Note {target.approve ? "(optionnel)" : "(motif)"}</label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTarget(null)}>Annuler</Button>
                <Button onClick={submit} disabled={submitting} variant={target.approve ? "default" : "destructive"}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (target.approve ? "Valider" : "Rejeter")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
