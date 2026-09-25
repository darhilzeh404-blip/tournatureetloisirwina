import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TICKET_STATUS_LABEL, TICKET_TYPE_META, type ManagedTicketType } from "@/lib/ticket-quotes";

export const Route = createFileRoute("/demandes-billets/")({ component: MyTicketRequests });
type Row = { id: string; request_number: string; ticket_type: ManagedTicketType; origin: string; destination: string; departure_date: string; status: string; created_at: string };

function MyTicketRequests() {
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const { data, error } = await (supabase as any).from("ticket_quote_requests").select("id,request_number,ticket_type,origin,destination,departure_date,status,created_at").order("created_at", { ascending: false }); if (!error) setRows((data ?? []) as Row[]); setLoading(false); })(); }, []);
  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-3xl px-5 py-8"><Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Billetterie</Link><header className="mt-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Ticket className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold">Mes demandes de billets</h1><p className="text-sm text-muted-foreground">Offres, paiement et documents de voyage.</p></div></header>{loading ? <div className="mt-10 flex justify-center"><Loader2 className="animate-spin" /></div> : rows.length === 0 ? <p className="mt-10 rounded-2xl border p-8 text-center text-sm text-muted-foreground">Vous n’avez pas encore envoyé de demande.</p> : <div className="mt-6 space-y-3">{rows.map((row) => <Link key={row.id} to="/demandes-billets/$requestId" params={{ requestId: row.id }} className="block rounded-2xl border bg-card p-4 transition hover:border-primary"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{row.request_number} · {TICKET_TYPE_META[row.ticket_type]?.shortLabel ?? "Billet"}</p><p className="mt-1 text-sm text-muted-foreground">{row.origin} → {row.destination} · {new Date(`${row.departure_date}T12:00:00`).toLocaleDateString("fr-FR")}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{TICKET_STATUS_LABEL[row.status] ?? row.status}</span></div></Link>)}</div>}</div></main>;
}
