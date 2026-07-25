import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plane, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vols")({
  component: AdminVols,
});

type Program = {
  id: string;
  agency_id: string;
  title: string;
  airline_name: string | null;
  flight_number: string | null;
  origin: string;
  destination: string;
  departure_at: string | null;
  arrival_at: string | null;
  price: number;
  service_fee: number | null;
  seats_total: number;
  seats_available: number;
  class: string | null;
  description: string | null;
  status: string;
  is_active: boolean;
};
type Agency = { id: string; name: string };

const empty = (): Partial<Program> => ({
  agency_id: "", title: "", airline_name: "", flight_number: "",
  origin: "Libreville", destination: "Paris",
  departure_at: null, arrival_at: null,
  price: 0, service_fee: 0, seats_total: 10, seats_available: 10,
  class: "Économique", description: "", status: "active", is_active: true,
});

function toInputDateTime(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function AdminVols() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Program>>(empty());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: a }] = await Promise.all([
      (supabase.from("flight_programs") as any).select("*").order("departure_at", { ascending: true }),
      (supabase.from("partner_agencies") as any).select("id,name").order("name"),
    ]);
    setPrograms(((p as any) ?? []) as Program[]);
    setAgencies(((a as any) ?? []) as Agency[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(empty()); setOpen(true); };
  const openEdit = (p: Program) => {
    setEditing({ ...p, departure_at: toInputDateTime(p.departure_at) as any, arrival_at: toInputDateTime(p.arrival_at) as any });
    setOpen(true);
  };

  const save = async () => {
    if (!editing.agency_id || !editing.title?.trim() || !editing.origin || !editing.destination) {
      toast.error("Agence, titre, origine et destination requis"); return;
    }
    setSaving(true);
    const payload: any = {
      agency_id: editing.agency_id,
      title: editing.title.trim(),
      airline_name: editing.airline_name || null,
      flight_number: editing.flight_number || null,
      origin: editing.origin,
      destination: editing.destination,
      departure_at: editing.departure_at ? new Date(editing.departure_at as any).toISOString() : null,
      arrival_at: editing.arrival_at ? new Date(editing.arrival_at as any).toISOString() : null,
      price: Number(editing.price ?? 0),
      service_fee: Number(editing.service_fee ?? 0),
      seats_total: Number(editing.seats_total ?? 0),
      class: editing.class || null,
      description: editing.description || null,
      status: editing.status || "active",
      is_active: editing.is_active ?? true,
    };
    if (!editing.id) {
      payload.seats_available = payload.seats_total;
      const { error } = await (supabase.from("flight_programs") as any).insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await (supabase.from("flight_programs") as any).update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    toast.success("Enregistré");
    setSaving(false); setOpen(false);
    load();
  };

  const remove = async (p: Program) => {
    if (!confirm(`Supprimer "${p.title}" ?`)) return;
    const { error } = await (supabase.from("flight_programs") as any).delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé"); load();
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Vols — Programmes</h1>
            <p className="text-xs text-muted-foreground">Gestion des vols proposés par les agences</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau vol</Button>
      </header>

      <div className="mt-6 rounded-2xl border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : programs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Aucun programme.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="p-3">Titre</th>
                <th className="p-3">Trajet</th>
                <th className="p-3">Départ</th>
                <th className="p-3">Prix</th>
                <th className="p-3">Places</th>
                <th className="p-3">Statut</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{p.title}<div className="text-xs text-muted-foreground">{p.airline_name} {p.flight_number}</div></td>
                  <td className="p-3">{p.origin} → {p.destination}</td>
                  <td className="p-3">{p.departure_at ? new Date(p.departure_at).toLocaleString("fr-FR") : "—"}</td>
                  <td className="p-3">{Number(p.price).toLocaleString("fr-FR")} FCFA</td>
                  <td className="p-3">{p.seats_available}/{p.seats_total}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active && p.status === "active" ? "bg-green-500/10 text-green-600" : "bg-muted"}`}>
                      {p.is_active ? p.status : "inactif"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Modifier le vol" : "Nouveau vol"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Agence</Label>
              <Select value={editing.agency_id ?? ""} onValueChange={(v) => setEditing({ ...editing, agency_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Titre</Label>
              <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><Label>Compagnie</Label>
              <Input value={editing.airline_name ?? ""} onChange={(e) => setEditing({ ...editing, airline_name: e.target.value })} /></div>
            <div><Label>N° vol</Label>
              <Input value={editing.flight_number ?? ""} onChange={(e) => setEditing({ ...editing, flight_number: e.target.value })} /></div>
            <div><Label>Origine</Label>
              <Input value={editing.origin ?? ""} onChange={(e) => setEditing({ ...editing, origin: e.target.value })} /></div>
            <div><Label>Destination</Label>
              <Input value={editing.destination ?? ""} onChange={(e) => setEditing({ ...editing, destination: e.target.value })} /></div>
            <div><Label>Départ</Label>
              <Input type="datetime-local" value={(editing.departure_at as any) ?? ""} onChange={(e) => setEditing({ ...editing, departure_at: e.target.value as any })} /></div>
            <div><Label>Arrivée</Label>
              <Input type="datetime-local" value={(editing.arrival_at as any) ?? ""} onChange={(e) => setEditing({ ...editing, arrival_at: e.target.value as any })} /></div>
            <div><Label>Prix (FCFA)</Label>
              <Input type="number" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
            <div><Label>Frais de service (FCFA)</Label>
              <Input type="number" value={editing.service_fee ?? 0} onChange={(e) => setEditing({ ...editing, service_fee: Number(e.target.value) })} /></div>
            <div><Label>Places totales</Label>
              <Input type="number" value={editing.seats_total ?? 0} onChange={(e) => setEditing({ ...editing, seats_total: Number(e.target.value) })} /></div>
            <div><Label>Classe</Label>
              <Input value={editing.class ?? ""} onChange={(e) => setEditing({ ...editing, class: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Description</Label>
              <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              <span className="text-sm">Actif (visible côté client)</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
