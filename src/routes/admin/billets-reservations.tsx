import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket as TicketIcon, Download, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/billets-reservations")({
  head: () => ({ meta: [{ title: "Réservations billets — Admin" }] }),
  component: AdminBilletsReservationsPage,
});

type Booking = {
  id: string;
  agency_id: string;
  ticket_id: string | null;
  user_id: string | null;
  passenger_name: string;
  passenger_phone: string | null;
  passenger_email: string | null;
  seats: number;
  total_amount: number;
  status: string;
  reference_code: string | null;
  created_at: string;
  details: any;
  partner_agencies?: { name: string | null } | null;
  partner_tickets?: { title: string | null; origin: string | null; destination: string | null; departure_at: string | null } | null;
};

const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  completed: "outline",
};

function AdminBilletsReservationsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_bookings" as any)
      .select("*, partner_agencies(name), partner_tickets(title, origin, destination, departure_at)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as Booking[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (
        r.passenger_name?.toLowerCase().includes(s) ||
        r.passenger_phone?.toLowerCase().includes(s) ||
        r.passenger_email?.toLowerCase().includes(s) ||
        r.reference_code?.toLowerCase().includes(s) ||
        r.partner_agencies?.name?.toLowerCase().includes(s) ||
        r.partner_tickets?.title?.toLowerCase().includes(s)
      );
    });
  }, [rows, q, status]);

  const exportCsv = () => {
    if (filtered.length === 0) return toast.error("Aucune réservation à exporter");
    const headers = [
      "Référence", "Date", "Client", "Téléphone", "Email",
      "Agence", "Billet", "Trajet", "Départ",
      "Places", "Montant (FCFA)", "Statut",
    ];
    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(",")];
    for (const r of filtered) {
      const trajet = r.partner_tickets
        ? `${r.partner_tickets.origin ?? ""} → ${r.partner_tickets.destination ?? ""}`
        : "";
      lines.push([
        r.reference_code ?? r.id,
        new Date(r.created_at).toLocaleString("fr-FR"),
        r.passenger_name ?? "",
        r.passenger_phone ?? "",
        r.passenger_email ?? "",
        r.partner_agencies?.name ?? "",
        r.partner_tickets?.title ?? "",
        trajet,
        r.partner_tickets?.departure_at ? new Date(r.partner_tickets.departure_at).toLocaleString("fr-FR") : "",
        String(r.seats),
        String(Math.round(r.total_amount)),
        r.status,
      ].map((v) => escape(String(v))).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations-billets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-primary" /> Réservations billets
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} réservation{filtered.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exporter CSV
        </Button>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher : client, téléphone, référence, agence…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmée</option>
          <option value="completed">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Chargement…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Aucune réservation trouvée.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Agence</th>
                  <th className="text-left px-4 py-3">Billet</th>
                  <th className="text-right px-4 py-3">Places</th>
                  <th className="text-right px-4 py-3">Montant</th>
                  <th className="text-left px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.reference_code ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3 font-medium">{r.passenger_name}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{r.passenger_phone ?? "—"}</div>
                      {r.passenger_email && <div className="text-muted-foreground">{r.passenger_email}</div>}
                    </td>
                    <td className="px-4 py-3">{r.partner_agencies?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.partner_tickets?.title ?? "—"}</div>
                      {r.partner_tickets && (r.partner_tickets.origin || r.partner_tickets.destination) && (
                        <div className="text-xs text-muted-foreground">
                          {r.partner_tickets.origin ?? "—"} → {r.partner_tickets.destination ?? "—"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{r.seats}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{FCFA(r.total_amount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
