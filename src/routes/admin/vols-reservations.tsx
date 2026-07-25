import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vols-reservations")({
  component: AdminVolBookings,
});

const STATUSES = ["pending_payment","paid","confirmed_by_agency","ticket_ready","delivered","cancelled","refunded","failed"];

type Booking = {
  id: string; reference_code: string; status: string; total_amount: number;
  seats: number; contact_name: string; contact_phone: string; contact_email: string;
  created_at: string; agency_id: string; program_id: string;
};

function AdminVolBookings() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = (supabase.from("flight_bookings") as any).select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows(((data as any) ?? []) as Booking[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    const { error } = await (supabase.from("flight_bookings") as any).update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Statut mis à jour"); load(); }
    setUpdating(null);
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dossiers vols</h1>
            <p className="text-xs text-muted-foreground">Suivi des réservations avion</p>
          </div>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      <div className="mt-6 rounded-2xl border bg-card overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Aucun dossier.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="p-3">Réf</th><th className="p-3">Client</th><th className="p-3">Places</th>
                <th className="p-3">Total</th><th className="p-3">Créé</th><th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs">{b.reference_code}</td>
                  <td className="p-3">
                    <div className="font-semibold">{b.contact_name}</div>
                    <div className="text-xs text-muted-foreground">{b.contact_phone} · {b.contact_email}</div>
                  </td>
                  <td className="p-3">{b.seats}</td>
                  <td className="p-3">{Number(b.total_amount).toLocaleString("fr-FR")} FCFA</td>
                  <td className="p-3 text-xs">{new Date(b.created_at).toLocaleString("fr-FR")}</td>
                  <td className="p-3">
                    <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)} disabled={updating === b.id}>
                      <SelectTrigger className="w-52">
                        {updating === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
