import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Search, MessageSquare, ImageIcon, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/paiements")({
  component: AdminPaiements,
});

type PaymentStatus = "PENDING" | "VALIDATED" | "REJECTED";

interface PaymentRow {
  id: string;
  reservation_id: string;
  user_id: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  admin_comment: string | null;
  transaction_ref: string | null;
  receipt_url: string | null;
  created_at: string;
  client_name?: string;
  signed_receipt_url?: string | null;
  service_type?: string | null;
  service_summary?: string;
}

const STATUS_MAP: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "En attente", variant: "outline" },
  VALIDATED: { label: "Validé", variant: "default" },
  REJECTED: { label: "Rejeté", variant: "destructive" },
};

const SERVICE_LABEL: Record<string, string> = {
  TRANSPORT_SCOLAIRE: "Transport Scolaire",
  LOCATION_BUS: "Location de Bus",
  CIRCUIT_TOURISTIQUE: "Circuit Touristique",
  VTC: "VTC",
  BILLET: "Billet",
};

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function AdminPaiements() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [serviceFilter, setServiceFilter] = useState<"ALL" | "BILLET" | "OTHER">("ALL");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadPayments();

    // Realtime: rafraîchit la liste quand un paiement est créé/modifié
    const channel = supabase
      .channel("admin-payments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast.info("Nouveau paiement reçu");
          }
          void loadPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadPayments() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erreur de chargement: " + error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as PaymentRow[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const reservationIds = Array.from(new Set(rows.map((r) => r.reservation_id)));
    const [{ data: profiles }, { data: reservations }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
      supabase.from("reservations").select("id, service_type, details").in("id", reservationIds),
    ]);
    const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));
    const resMap = new Map((reservations || []).map((r) => [r.id, r] as const));

    const enriched = await Promise.all(
      rows.map(async (r) => {
        let signed: string | null = null;
        if (r.receipt_url) {
          const { data: s } = await supabase.storage
            .from("payment-receipts")
            .createSignedUrl(r.receipt_url, 3600);
          signed = s?.signedUrl ?? null;
        }
        const res = resMap.get(r.reservation_id);
        const d = (res?.details as Record<string, unknown> | null) || null;
        const summary = d
          ? (d.title as string) ||
            (d.route as string) ||
            (d.circuit as string) ||
            (d.package_id ? "Forfait" : "")
          : "";
        return {
          ...r,
          client_name: nameMap.get(r.user_id) || "—",
          signed_receipt_url: signed,
          service_type: res?.service_type ?? null,
          service_summary: summary,
        };
      })
    );

    setPayments(enriched);
    setLoading(false);
  }

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.client_name || "").toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.reservation_id.toLowerCase().includes(q) ||
      (p.transaction_ref || "").toLowerCase().includes(q)
    );
  });

  const validate = async (id: string) => {
    const { error } = await supabase.from("payments").update({ status: "VALIDATED" }).eq("id", id);
    if (error) return toast.error(error.message);
    // Update reservation paid amount + status
    const p = payments.find((x) => x.id === id);
    if (p) {
      await supabase
        .from("reservations")
        .update({ status: "CONFIRMED", paid_amount: p.amount })
        .eq("id", p.reservation_id);
    }
    toast.success("Paiement validé");
    void loadPayments();
  };

  const reject = async (id: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "REJECTED", admin_comment: rejectComment || "Rejeté par l'admin" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setRejectTarget(null);
    setRejectComment("");
    toast.success("Paiement rejeté");
    void loadPayments();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  const pendingCount = payments.filter((p) => p.status === "PENDING").length;
  const totalValidated = payments.filter((p) => p.status === "VALIDATED").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Paiements</h1>
        <p className="text-sm text-muted-foreground">Vérifiez la photo du reçu et la référence avant validation</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">En attente</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Total validé</p>
            <p className="text-2xl font-bold">{formatXAF(totalValidated)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Total paiements</p>
            <p className="text-2xl font-bold">{payments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher (client, ref, ID)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Cards list (better for photos than a table) */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">Aucun paiement trouvé.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((p) => {
            const st = STATUS_MAP[p.status];
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Receipt thumbnail */}
                    <button
                      type="button"
                      onClick={() => p.signed_receipt_url && setPreviewUrl(p.signed_receipt_url)}
                      className="relative h-40 w-full shrink-0 bg-muted sm:h-auto sm:w-40"
                    >
                      {p.signed_receipt_url ? (
                        <img
                          src={p.signed_receipt_url}
                          alt={`Reçu ${p.transaction_ref || p.id}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{p.client_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleString("fr-FR")}
                          </p>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Montant</p>
                          <p className="font-semibold">{formatXAF(p.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Méthode</p>
                          <p>{p.method}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Référence transaction</p>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                            {p.transaction_ref || "—"}
                          </code>
                          {p.transaction_ref && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(p.transaction_ref!)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Réservation</p>
                        <code className="text-xs">{p.reservation_id.slice(0, 8)}…</code>
                      </div>

                      {p.admin_comment && (
                        <p className="flex items-start gap-1 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" /> {p.admin_comment}
                        </p>
                      )}

                      {p.status === "PENDING" && (
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" onClick={() => validate(p.id)} className="flex-1">
                            <CheckCircle className="mr-1 h-4 w-4" /> Valider
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectTarget(p.id)} className="flex-1">
                            <XCircle className="mr-1 h-4 w-4" /> Rejeter
                          </Button>
                        </div>
                      )}

                      {p.signed_receipt_url && (
                        <a
                          href={p.signed_receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Ouvrir le reçu en grand
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Receipt preview modal */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reçu de paiement</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Reçu" className="max-h-[75vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-lg font-bold">Rejeter le paiement</h3>
              <p className="text-sm text-muted-foreground">Ajoutez un commentaire de rejet pour le client.</p>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Raison du rejet…"
                className="h-24 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectComment(""); }}>Annuler</Button>
                <Button variant="destructive" onClick={() => reject(rejectTarget)}>Confirmer le rejet</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
