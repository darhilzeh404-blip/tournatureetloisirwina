import { NumericField } from "@/components/ui/numeric-field";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTrainRoutes, stationsForTrainType,
  type TrainType, type TrainStation, type TrainClass,
  type TrainRoute, type TrainRouteStation,
} from "@/lib/train";

type Agency = { id: string; name: string };

type TicketRow = {
  id: string;
  agency_id: string;
  title: string;
  origin: string | null;
  destination: string | null;
  departure_at: string | null;
  price: number;
  seats_total: number | null;
  seats_available: number;
  description: string;
  is_active: boolean;
  train_type_id: string | null;
  origin_station_id: string | null;
  destination_station_id: string | null;
  service_start_date: string | null;
  service_end_date: string | null;
};

type FormState = {
  id?: string;
  agency_id: string;
  train_type_id: string;
  origin_station_id: string;
  destination_station_id: string;
  service_start_date: string;
  service_end_date: string;
  departure_time: string;
  seats_total: number;
  description: string;
  is_active: boolean;
  prices: Record<string, number>;
};

const emptyForm = (): FormState => ({
  agency_id: "", train_type_id: "", origin_station_id: "", destination_station_id: "",
  service_start_date: "", service_end_date: "", departure_time: "08:00",
  seats_total: 50, description: "", is_active: true, prices: {},
});

const p2 = (n: number) => String(n).padStart(2, "0");

function toDateInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function toTimeInput(v: string | null) {
  if (!v) return "08:00";
  const d = new Date(v);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Fin du mois de la date donnée (agenda mensuel). */
function endOfMonth(dateStr: string) {
  if (!dateStr) return "";
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}-${p2(m)}-${p2(new Date(y, m, 0).getDate())}`;
}

const frDate = (v: string | null) =>
  v ? new Date(`${v}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

export function TrainTickets({
  types, stations, classes,
}: { types: TrainType[]; stations: TrainStation[]; classes: TrainClass[] }) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [routes, setRoutes] = useState<TrainRoute[]>([]);
  const [routeStations, setRouteStations] = useState<TrainRouteStation[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: ag }, { data: tk }, r] = await Promise.all([
      supabase.from("partner_agencies").select("id,name").eq("category", "train" as any).order("name"),
      supabase
        .from("partner_tickets")
        .select("id,agency_id,title,origin,destination,departure_at,price,seats_total,seats_available,description,is_active,train_type_id,origin_station_id,destination_station_id,service_start_date,service_end_date")
        .not("train_type_id", "is", null)
        .order("service_start_date", { ascending: true, nullsFirst: false }),
      fetchTrainRoutes(),
    ]);
    setAgencies(((ag as any) ?? []) as Agency[]);
    setTickets(((tk as any) ?? []) as TicketRow[]);
    setRoutes(r.routes);
    setRouteStations(r.routeStations);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const activeClasses = useMemo(() => classes.filter((c) => c.is_active), [classes]);
  const selectedType = types.find((t) => t.id === form.train_type_id);
  const availableStations = useMemo(
    () => stationsForTrainType(selectedType, stations, routes, routeStations),
    [selectedType, stations, routes, routeStations],
  );

  const stationName = (id: string | null) => stations.find((s) => s.id === id)?.name ?? "";
  const typeName = (id: string | null) => types.find((t) => t.id === id)?.name ?? "";
  const agencyName = (id: string) => agencies.find((a) => a.id === id)?.name ?? "";

  const openNew = () => { setForm(emptyForm()); setShowForm(true); };

  const openEdit = async (t: TicketRow) => {
    const { data } = await supabase
      .from("train_ticket_classes" as any)
      .select("class_id, price")
      .eq("ticket_id", t.id);
    const prices: Record<string, number> = {};
    ((data as any) ?? []).forEach((r: any) => { prices[r.class_id] = Number(r.price); });
    setForm({
      id: t.id,
      agency_id: t.agency_id,
      train_type_id: t.train_type_id ?? "",
      origin_station_id: t.origin_station_id ?? "",
      destination_station_id: t.destination_station_id ?? "",
      service_start_date: t.service_start_date ?? toDateInput(t.departure_at),
      service_end_date: t.service_end_date ?? endOfMonth(t.service_start_date ?? toDateInput(t.departure_at)),
      departure_time: toTimeInput(t.departure_at),
      seats_total: t.seats_total ?? t.seats_available ?? 0,
      description: t.description ?? "",
      is_active: t.is_active,
      prices,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.agency_id) return toast.error("Agence ferroviaire requise");
    if (!form.train_type_id) return toast.error("Type de train requis");
    if (!form.origin_station_id || !form.destination_station_id) return toast.error("Gares de départ et d'arrivée requises");
    if (form.origin_station_id === form.destination_station_id) return toast.error("Les deux gares doivent être différentes");
    if (!form.service_start_date || !form.service_end_date) return toast.error("Période de circulation requise (début et fin)");
    if (form.service_end_date < form.service_start_date) return toast.error("La fin de période doit suivre le début");
    const priced = activeClasses.filter((c) => Number(form.prices[c.id]) > 0);
    if (priced.length === 0) return toast.error("Renseignez au moins un tarif de classe");

    setBusy(true);
    const origin = stationName(form.origin_station_id);
    const destination = stationName(form.destination_station_id);
    const minPrice = Math.min(...priced.map((c) => Number(form.prices[c.id])));
    const payload: any = {
      agency_id: form.agency_id,
      title: `${typeName(form.train_type_id)} — ${origin} → ${destination}`,
      origin,
      destination,
      departure_at: new Date(`${form.service_start_date}T${form.departure_time || "08:00"}:00`).toISOString(),
      service_start_date: form.service_start_date,
      service_end_date: form.service_end_date,
      price: minPrice,
      seats_total: Number(form.seats_total) || 0,
      description: form.description,
      is_active: form.is_active,
      transport_mode: "train",
      train_type_id: form.train_type_id,
      origin_station_id: form.origin_station_id,
      destination_station_id: form.destination_station_id,
    };

    let ticketId = form.id;
    if (!ticketId) {
      payload.seats_available = payload.seats_total;
      const { data, error } = await supabase.from("partner_tickets").insert(payload).select("id").single();
      if (error) { setBusy(false); return toast.error(error.message); }
      ticketId = (data as any).id;
    } else {
      const { error } = await supabase.from("partner_tickets").update(payload).eq("id", ticketId);
      if (error) { setBusy(false); return toast.error(error.message); }
    }

    await supabase.from("train_ticket_classes" as any).delete().eq("ticket_id", ticketId!);
    const rows = priced.map((c) => ({ ticket_id: ticketId, class_id: c.id, price: Number(form.prices[c.id]) }));
    const { error: pErr } = await supabase.from("train_ticket_classes" as any).insert(rows as any);
    setBusy(false);
    if (pErr) return toast.error(pErr.message);
    toast.success("Billet de train enregistré");
    setShowForm(false);
    setForm(emptyForm());
    load();
  };

  const remove = async (t: TicketRow) => {
    if (!confirm(`Supprimer le billet "${t.title}" ?`)) return;
    const { error } = await supabase.from("partner_tickets").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Billet supprimé");
    load();
  };

  const toggle = async (t: TicketRow, v: boolean) => {
    const { error } = await supabase.from("partner_tickets").update({ is_active: v }).eq("id", t.id);
    if (error) return toast.error(error.message);
    setTickets(tickets.map((x) => (x.id === t.id ? { ...x, is_active: v } : x)));
  };

  return (
    <Card><CardContent className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Ticket className="h-4 w-4 text-primary" /> Billets de train</h2>
          <p className="text-xs text-muted-foreground">
            Créez les billets à partir des types, gares et classes configurés ci-dessus. Les billets actifs sont visibles côté client.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau billet</Button>
      </div>

      {agencies.length === 0 && (
        <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          Aucune agence de catégorie « train ». Créez-en une dans Agences partenaires.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun billet de train pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <div className="min-w-52 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {agencyName(t.agency_id)} · Du {frDate(t.service_start_date)} au {frDate(t.service_end_date)} ·
                  {" "}dès {Number(t.price).toLocaleString("fr-FR")} FCFA · {t.seats_available}/{t.seats_total ?? 0} places
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={t.is_active} onCheckedChange={(v) => toggle(t, v)} />
                {t.is_active ? "Visible" : "Masqué"}
              </label>
              <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="grid gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2">
          <div>
            <Label>Agence ferroviaire</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.agency_id} onChange={(e) => setForm({ ...form, agency_id: e.target.value })}>
              <option value="">Choisir…</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Type de train</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.train_type_id}
              onChange={(e) => setForm({ ...form, train_type_id: e.target.value, origin_station_id: "", destination_station_id: "" })}>
              <option value="">Choisir…</option>
              {types.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Gare de départ</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.origin_station_id} onChange={(e) => setForm({ ...form, origin_station_id: e.target.value })}>
              <option value="">Choisir…</option>
              {availableStations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Gare d'arrivée</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.destination_station_id} onChange={(e) => setForm({ ...form, destination_station_id: e.target.value })}>
              <option value="">Choisir…</option>
              {availableStations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Début de la période (mois)</Label>
            <Input
              type="date"
              value={form.service_start_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  service_start_date: e.target.value,
                  service_end_date: form.service_end_date || endOfMonth(e.target.value),
                })
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Le client choisit librement sa date dans cette période.</p>
          </div>
          <div>
            <Label>Fin de la période</Label>
            <Input
              type="date"
              min={form.service_start_date || undefined}
              value={form.service_end_date}
              onChange={(e) => setForm({ ...form, service_end_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Heure de départ</Label>
            <Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} />
          </div>
          <div>
            <Label>Places totales</Label>
            <NumericField min={0} value={form.seats_total} onChange={(v: number) => setForm({ ...form, seats_total: v })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Tarifs par classe (FCFA)</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {activeClasses.map((c) => (
                <div key={c.id}>
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                  <NumericField min={0} value={form.prices[c.id] ?? ""}
                    onChange={(v: number) => setForm({ ...form, prices: { ...form.prices, [c.id]: v } })} />
                </div>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            Visible côté client
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm()); }}>Annuler</Button>
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}
