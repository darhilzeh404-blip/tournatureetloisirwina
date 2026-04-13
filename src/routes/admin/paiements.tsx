import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle, XCircle, Search, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/paiements")({
  component: AdminPaiements,
});

type PaymentStatus = "PENDING" | "VALIDATED" | "REJECTED";

interface Payment {
  id: string;
  reservationId: string;
  client: string;
  montant: number;
  methode: string;
  date: string;
  status: PaymentStatus;
  commentaire?: string;
}

const INITIAL_PAYMENTS: Payment[] = [
  { id: "PAY-050", reservationId: "RES-127", client: "Marie Ndong", montant: 75000, methode: "Mobile Money", date: "2026-04-13", status: "PENDING" },
  { id: "PAY-049", reservationId: "RES-126", client: "Pierre Obame", montant: 90000, methode: "Virement", date: "2026-04-12", status: "VALIDATED" },
  { id: "PAY-048", reservationId: "RES-125", client: "Alice Mba", montant: 42500, methode: "Mobile Money", date: "2026-04-11", status: "VALIDATED" },
  { id: "PAY-047", reservationId: "RES-124", client: "Jean Nzeng", montant: 80000, methode: "Espèces", date: "2026-04-10", status: "REJECTED", commentaire: "Montant incorrect" },
  { id: "PAY-046", reservationId: "RES-123", client: "Sophie Ondo", montant: 125000, methode: "Mobile Money", date: "2026-04-09", status: "PENDING" },
  { id: "PAY-045", reservationId: "RES-122", client: "Eric Mba", montant: 32500, methode: "Virement", date: "2026-04-08", status: "REJECTED", commentaire: "Réservation annulée" },
];

const STATUS_MAP: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "En attente", variant: "outline" },
  VALIDATED: { label: "Validé", variant: "default" },
  REJECTED: { label: "Rejeté", variant: "destructive" },
};

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function AdminPaiements() {
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const filtered = payments.filter(
    (p) =>
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.reservationId.toLowerCase().includes(search.toLowerCase())
  );

  const validate = (id: string) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "VALIDATED" as const } : p)));
  };

  const reject = (id: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "REJECTED" as const, commentaire: rejectComment || "Rejeté par l'admin" } : p))
    );
    setRejectTarget(null);
    setRejectComment("");
  };

  const pendingCount = payments.filter((p) => p.status === "PENDING").length;
  const totalValidated = payments.filter((p) => p.status === "VALIDATED").reduce((s, p) => s + p.montant, 0);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Paiements</h1>
        <p className="text-sm text-muted-foreground">Validez ou rejetez les paiements clients</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">En attente</p>
            <p className="text-2xl font-bold text-warning-foreground">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Total validé</p>
            <p className="text-2xl font-bold text-success">{formatXAF(totalValidated)}</p>
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
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="p-4">ID</th>
                <th className="p-4">Réservation</th>
                <th className="p-4">Client</th>
                <th className="p-4">Montant</th>
                <th className="p-4 hidden sm:table-cell">Méthode</th>
                <th className="p-4">Date</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const st = STATUS_MAP[p.status];
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 font-medium">{p.id}</td>
                    <td className="p-4">{p.reservationId}</td>
                    <td className="p-4">{p.client}</td>
                    <td className="p-4 font-medium">{formatXAF(p.montant)}</td>
                    <td className="p-4 hidden sm:table-cell">{p.methode}</td>
                    <td className="p-4">{p.date}</td>
                    <td className="p-4">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {p.commentaire && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {p.commentaire}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      {p.status === "PENDING" && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="text-success" onClick={() => validate(p.id)}>
                            <CheckCircle className="mr-1 h-4 w-4" /> Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRejectTarget(p.id)}
                          >
                            <XCircle className="mr-1 h-4 w-4" /> Rejeter
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun paiement trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
