import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2, Search, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FCFA, fmtDate, fmtDateTime, REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/flight-quotes";

export const Route = createFileRoute("/admin/vols-demandes")({
  component: AdminFlightRequests,
});

type Req = {
  id: string; request_number: string; user_id: string;
  contact_name: string; contact_phone: string; contact_email: string | null;
  origin: string; destination: string; trip_type: string;
  departure_date: string; return_date: string | null;
  adults: number; children: number; infants: number;
  client_note: string | null; status: string; admin_note: string | null;
  created_at: string;
};

type Offer = {
  id?: string; request_id?: string;
  airline_name: string; flight_number: string; flight_date: string;
  departure_time: string; arrival_time: string; duration: string; stopovers: string;
  travel_class: string; cabin_baggage: string; checked_baggage: string;
  conditions: string; unit_price: number; total_amount: number;
  valid_until: string; comments: string;
};

type Passenger = {
  id: string; passenger_type: string; last_name: string; first_name: string;
  gender: string | null; birth_date: string | null; nationality: string | null;
  doc_type: string | null; doc_number: string | null; doc_expiry: string | null;
  doc_country: string | null; phone: string | null; email: string | null;
  guardian_name: string | null; guardian_relation: string | null;
};

const FILTERS = [
  ["all", "Toutes"],
  ["pending", "En attente"],
  ["offer_sent", "Offre envoyée"],
  ["accepted_pending_payment", "Acceptée"],
  ["refused", "Refusée"],
  ["paid", "Payée"],
  ["ticket_issued", "Billet émis"],
  ["cancelled", "Annulée"],
  ["completed", "Terminée"],
] as const;

const emptyOffer = (): Offer => ({
  airline_name: "", flight_number: "", flight_date: "", departure_time: "", arrival_time: "",
  duration: "", stopovers: "", travel_class: "Économique", cabin_baggage: "", checked_baggage: "",
  conditions: "", unit_price: 0, total_amount: 0,
  valid_until: new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16),
  comments: "",
});

function AdminFlightRequests() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [current, setCurrent] = useState<Req | null>(null);
  const [offer, setOffer] = useState<Offer>(emptyOffer());
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = (supabase.from("flight_quote_requests") as any).select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as Req[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.request_number, r.contact_name, r.contact_phone, r.contact_email, r.origin, r.destination, r.departure_date]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s)));
  }, [rows, search]);

  const openRequest = async (r: Req) => {
    setCurrent(r);
    setOffer(emptyOffer());
    const [{ data: o }, { data: p }, { data: ev }] = await Promise.all([
      (supabase.from("flight_quote_offers") as any).select("*").eq("request_id", r.id).maybeSingle(),
      (supabase.from("flight_quote_passengers") as any).select("*").eq("request_id", r.id).order("created_at"),
      (supabase.from("flight_quote_events") as any).select("*").eq("request_id", r.id).order("created_at", { ascending: false }),
    ]);
    if (o) {
      setOffer({
        ...emptyOffer(),
        ...(o as any),
        flight_date: (o as any).flight_date ?? "",
        valid_until: (o as any).valid_until ? new Date((o as any).valid_until).toISOString().slice(0, 16) : emptyOffer().valid_until,
      });
    }
    setPassengers(((p as any) ?? []) as Passenger[]);
    setEvents(((ev as any) ?? []) as any[]);
  };

  const sendOffer = async () => {
    if (!current) return;
    if (!offer.airline_name.trim()) { toast.error("Compagnie aérienne requise"); return; }
    if (!offer.total_amount || offer.total_amount <= 0) { toast.error("Prix final requis"); return; }
    if (!offer.valid_until) { toast.error("Durée de validité requise"); return; }
    setSaving(true);
    const payload: any = {
      request_id: current.id,
      airline_name: offer.airline_name.trim(),
      flight_number: offer.flight_number || null,
      flight_date: offer.flight_date || null,
      departure_time: offer.departure_time || null,
      arrival_time: offer.arrival_time || null,
      duration: offer.duration || null,
      stopovers: offer.stopovers || null,
      travel_class: offer.travel_class || null,
      cabin_baggage: offer.cabin_baggage || null,
      checked_baggage: offer.checked_baggage || null,
      conditions: offer.conditions || null,
      unit_price: Number(offer.unit_price ?? 0),
      total_amount: Number(offer.total_amount),
      valid_until: new Date(offer.valid_until).toISOString(),
      comments: offer.comments || null,
    };
    const { error } = await (supabase.from("flight_quote_offers") as any)
      .upsert(payload, { onConflict: "request_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Offre envoyée au client");
    setCurrent(null);
    load();
  };

  const setStatus = async (status: string) => {
    if (!current) return;
    const { error } = await (supabase.from("flight_quote_requests") as any)
      .update({ status }).eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Statut mis à jour");
    setCurrent(null);
    load();
  };

  return (
    <div className="p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Demandes de vols</h1>
            <p className="text-xs text-muted-foreground">Répondez aux clients avec un tarif personnalisé</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-64 pl-9" placeholder="Nom, téléphone, destination, n° demande…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      {loading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Aucune demande.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {filtered.map((r) => (
            <button key={r.id} onClick={() => openRequest(r)}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary">
              <div className="min-w-0">
                <p className="text-sm font-bold">{r.request_number} · {r.contact_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.origin} → {r.destination} · {fmtDate(r.departure_date)}
                  {r.trip_type === "round_trip" ? ` · retour ${fmtDate(r.return_date)}` : " · aller simple"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.adults} adulte(s), {r.children} enfant(s), {r.infants} bébé(s) · {r.contact_phone} · {fmtDateTime(r.created_at)}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${REQUEST_STATUS_CLASS[r.status] ?? "bg-muted"}`}>
                {REQUEST_STATUS_LABEL[r.status] ?? r.status}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!current} onOpenChange={(o) => !o && setCurrent(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Demande {current?.request_number}</DialogTitle>
          </DialogHeader>

          {current && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{current.contact_name} · {current.contact_phone}</p>
                <p className="text-muted-foreground">{current.contact_email}</p>
                <p className="mt-1">{current.origin} → {current.destination}</p>
                <p className="text-muted-foreground">
                  Départ {fmtDate(current.departure_date)}
                  {current.trip_type === "round_trip" ? ` · Retour ${fmtDate(current.return_date)}` : " · Aller simple"}
                </p>
                <p className="text-muted-foreground">
                  {current.adults} adulte(s), {current.children} enfant(s), {current.infants} bébé(s)
                </p>
                {current.client_note && <p className="mt-1 italic text-muted-foreground">« {current.client_note} »</p>}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Send className="h-4 w-4" /> Offre à envoyer</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Compagnie aérienne</Label>
                    <Input value={offer.airline_name} onChange={(e) => setOffer({ ...offer, airline_name: e.target.value })} /></div>
                  <div><Label>Numéro du vol</Label>
                    <Input value={offer.flight_number} onChange={(e) => setOffer({ ...offer, flight_number: e.target.value })} /></div>
                  <div><Label>Date</Label>
                    <Input type="date" value={offer.flight_date} onChange={(e) => setOffer({ ...offer, flight_date: e.target.value })} /></div>
                  <div><Label>Classe</Label>
                    <Input value={offer.travel_class} onChange={(e) => setOffer({ ...offer, travel_class: e.target.value })} /></div>
                  <div><Label>Heure de départ</Label>
                    <Input type="time" value={offer.departure_time} onChange={(e) => setOffer({ ...offer, departure_time: e.target.value })} /></div>
                  <div><Label>Heure d'arrivée</Label>
                    <Input type="time" value={offer.arrival_time} onChange={(e) => setOffer({ ...offer, arrival_time: e.target.value })} /></div>
                  <div><Label>Durée</Label>
                    <Input placeholder="6h30" value={offer.duration} onChange={(e) => setOffer({ ...offer, duration: e.target.value })} /></div>
                  <div><Label>Escales</Label>
                    <Input placeholder="Direct / Casablanca" value={offer.stopovers} onChange={(e) => setOffer({ ...offer, stopovers: e.target.value })} /></div>
                  <div><Label>Bagages cabine</Label>
                    <Input placeholder="1 x 8 kg" value={offer.cabin_baggage} onChange={(e) => setOffer({ ...offer, cabin_baggage: e.target.value })} /></div>
                  <div><Label>Bagages soute</Label>
                    <Input placeholder="2 x 23 kg" value={offer.checked_baggage} onChange={(e) => setOffer({ ...offer, checked_baggage: e.target.value })} /></div>
                  <div><Label>Prix unitaire (FCFA)</Label>
                    <Input type="number" min={0} value={offer.unit_price} onChange={(e) => setOffer({ ...offer, unit_price: Number(e.target.value) })} /></div>
                  <div><Label>Prix final total (FCFA)</Label>
                    <Input type="number" min={0} value={offer.total_amount} onChange={(e) => setOffer({ ...offer, total_amount: Number(e.target.value) })} /></div>
                  <div className="sm:col-span-2"><Label>Validité de l'offre</Label>
                    <Input type="datetime-local" value={offer.valid_until} onChange={(e) => setOffer({ ...offer, valid_until: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Conditions</Label>
                    <Textarea rows={2} value={offer.conditions} onChange={(e) => setOffer({ ...offer, conditions: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Commentaires</Label>
                    <Textarea rows={2} value={offer.comments} onChange={(e) => setOffer({ ...offer, comments: e.target.value })} /></div>
                </div>
              </div>

              {passengers.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold">Passagers ({passengers.length})</h3>
                  <div className="space-y-1.5">
                    {passengers.map((p) => (
                      <div key={p.id} className="rounded-xl border p-2.5 text-xs">
                        <span className="font-semibold">
                          {p.passenger_type === "adult" ? "Adulte" : p.passenger_type === "child" ? "Enfant" : "Bébé"} ·{" "}
                          {p.last_name} {p.first_name}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}— {p.gender ?? "—"} · né(e) le {fmtDate(p.birth_date)} · {p.nationality ?? "—"}
                          {p.doc_number ? ` · ${p.doc_type ?? "Pièce"} ${p.doc_number}` : ""}
                          {p.guardian_name ? ` · accompagné de ${p.guardian_name} (${p.guardian_relation ?? "—"})` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {events.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold">Historique</h3>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {events.map((e) => (
                      <li key={e.id}>{fmtDateTime(e.created_at)} — {e.action}{e.to_status ? ` → ${REQUEST_STATUS_LABEL[e.to_status] ?? e.to_status}` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${REQUEST_STATUS_CLASS[current.status] ?? "bg-muted"}`}>
                  {REQUEST_STATUS_LABEL[current.status] ?? current.status}
                </span>
                {current.status === "paid" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus("ticket_issued")}>Marquer billet émis</Button>
                )}
                {current.status === "ticket_issued" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus("completed")}>Terminer</Button>
                )}
                {!["cancelled", "completed"].includes(current.status) && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus("cancelled")}>Annuler la demande</Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCurrent(null)}>Fermer</Button>
            <Button onClick={sendOffer} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Envoyer l'offre ({FCFA(offer.total_amount)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
