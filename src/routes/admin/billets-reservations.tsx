import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket as TicketIcon, Download, Search, X, FileText, Loader2 } from "lucide-react";
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
  departure_date: string | null;
  baggage_count: number | null;
  baggage_fee: number | null;
  details: any;
  partner_agencies?: { name: string | null } | null;
  partner_tickets?: { title: string | null; origin: string | null; destination: string | null; departure_at: string | null } | null;
};

type Passenger = {
  id: string; last_name: string; first_name: string; phone: string | null; email: string | null;
  age: number | null; id_document_type: string; id_document_number: string | null; id_document_url: string | null;
};
type Child = { id: string; last_name: string; first_name: string; age: number };

const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmé" },
  { value: "ticket_ready", label: "Billet prêt" },
  { value: "delivered", label: "Livré" },
  { value: "cancelled", label: "Annulé" },
] as const;

const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  ticket_ready: "default",
  delivered: "outline",
  cancelled: "destructive",
  completed: "outline",
};

function AdminBilletsReservationsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [detail, setDetail] = useState<Booking | null>(null);
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [busy, setBusy] = useState(false);

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

  const openDetail = async (r: Booking) => {
    setDetail(r);
    setPassenger(null);
    setChildren([]);
    const [p, c] = await Promise.all([
      supabase.from("train_passengers" as any).select("*").eq("booking_id", r.id).maybeSingle(),
      supabase.from("train_children" as any).select("*").eq("booking_id", r.id),
    ]);
    setPassenger((p.data as any) ?? null);
    setChildren(((c.data as any) ?? []) as Child[]);
  };

  const changeStatus = async (r: Booking, newStatus: string) => {
    setBusy(true);
    const { error } = await supabase.from("partner_bookings" as any).update({ status: newStatus }).eq("id", r.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Statut : ${statusLabel(newStatus)}`);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: newStatus } : x)));
    setDetail((d) => (d && d.id === r.id ? { ...d, status: newStatus } : d));
  };

  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from("train-documents").createSignedUrl(path, 300);
    if (error || !data) return toast.error("Document indisponible");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const receipt = async (r: Booking) => {
    const d = r.details ?? {};
    const { downloadTrainReceipt } = await import("@/lib/train-receipt");
    downloadTrainReceipt({
      reference: r.reference_code ?? r.id.slice(0, 8).toUpperCase(),
      agency: r.partner_agencies?.name ?? d.agency ?? "—",
      trainType: d.train_type ?? "—",
      travelClass: d.travel_class ?? "—",
      departureDate: r.departure_date ? new Date(r.departure_date).toLocaleDateString("fr-FR") : "—",
      origin: d.station_from ?? r.partner_tickets?.origin ?? "—",
      destination: d.station_to ?? r.partner_tickets?.destination ?? "—",
      passenger: r.passenger_name,
      passengerPhone: r.passenger_phone,
      passengerEmail: r.passenger_email,
      idDocument: d.id_document_label ?? null,
      children: d.children ?? [],
      baggageCount: r.baggage_count ?? 0,
      baggageFee: Number(r.baggage_fee ?? 0),
      grossTotal: d.gross_total,
      discountLines: d.discounts ?? [],
      amountPaid: r.total_amount,
      paidAt: new Date(r.created_at).toLocaleString("fr-FR"),
      statusLabel: statusLabel(r.status),
    });
    toast.success("Reçu PDF généré");
  };

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
      const d = r.details ?? {};
      const trajet = d.station_from
        ? `${d.station_from} → ${d.station_to}`
        : r.partner_tickets
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
        r.departure_date
          ? new Date(r.departure_date).toLocaleDateString("fr-FR")
          : r.partner_tickets?.departure_at ? new Date(r.partner_tickets.departure_at).toLocaleString("fr-FR") : "",
        String(r.seats),
        String(Math.round(r.total_amount)),
        statusLabel(r.status),
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
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
                  <th className="text-left px-4 py-3">Agence</th>
                  <th className="text-left px-4 py-3">Billet</th>
                  <th className="text-right px-4 py-3">Places</th>
                  <th className="text-right px-4 py-3">Montant</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.reference_code ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.passenger_name}</div>
                      <div className="text-xs text-muted-foreground">{r.passenger_phone ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">{r.partner_agencies?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.partner_tickets?.title ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {(r.details?.station_from ?? r.partner_tickets?.origin) ?? "—"} → {(r.details?.station_to ?? r.partner_tickets?.destination) ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{r.seats}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{FCFA(r.total_amount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[r.status] ?? "secondary"}>{statusLabel(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetail(r)}>Détails</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{detail.partner_tickets?.title ?? "Réservation"}</h2>
                <p className="font-mono text-xs text-muted-foreground">{detail.reference_code ?? detail.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              {[
                ["Agence", detail.partner_agencies?.name ?? "—"],
                ["Train", detail.details?.train_type ?? "—"],
                ["Classe", detail.details?.travel_class ?? "—"],
                ["Date de départ", detail.departure_date ? new Date(detail.departure_date).toLocaleDateString("fr-FR") : "—"],
                ["Trajet", `${detail.details?.station_from ?? "—"} → ${detail.details?.station_to ?? "—"}`],
                ["Voyageur", `${detail.passenger_name} · ${detail.passenger_phone ?? "—"}`],
                ["Email", detail.passenger_email ?? "—"],
                ["Bagages", `${detail.baggage_count ?? 0} · ${FCFA(Number(detail.baggage_fee ?? 0))}`],
                ["Montant", FCFA(detail.total_amount)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b pb-1">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {passenger && (
              <div className="mt-4 rounded-xl border p-3 text-sm">
                <p className="text-xs font-bold uppercase text-muted-foreground">Pièce d'identité</p>
                <p className="mt-1">{detail.details?.id_document_label ?? passenger.id_document_type} {passenger.id_document_number ? `· ${passenger.id_document_number}` : ""}</p>
                {passenger.id_document_url && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => openDocument(passenger.id_document_url!)}>
                    <FileText className="h-4 w-4 mr-1" /> Voir le document
                  </Button>
                )}
              </div>
            )}

            {children.length > 0 && (
              <div className="mt-4 rounded-xl border p-3 text-sm">
                <p className="text-xs font-bold uppercase text-muted-foreground">Enfants</p>
                <ul className="mt-1 space-y-0.5">
                  {children.map((c) => <li key={c.id}>{c.first_name} {c.last_name} — {c.age} ans</li>)}
                </ul>
              </div>
            )}

            <div className="mt-5">
              <p className="text-xs font-bold uppercase text-muted-foreground">Statut de la réservation</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    disabled={busy}
                    onClick={() => changeStatus(detail, s.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${detail.status === s.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => receipt(detail)}>
                <Download className="h-4 w-4 mr-1" /> Reçu PDF
              </Button>
              <Button disabled={busy} onClick={() => changeStatus(detail, "ticket_ready")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Générer le billet définitif
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
