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
import { FCFA, fmtDate, PROGRAM_STATUS_LABEL } from "@/lib/flight-quotes";
import { NumericField } from "@/components/ui/numeric-field";

export const Route = createFileRoute("/admin/vols")({
  component: AdminVols,
});

type Program = {
  id: string;
  agency_id: string;
  origin: string;
  destination: string;
  price_from: number;
  month_start: string;
  month_end: string;
  status: string;
  description: string | null;
  conditions: string | null;
  is_active: boolean;
};
type Agency = { id: string; name: string };

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const lastOfMonth = () => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const empty = (): Partial<Program> => ({
  agency_id: "",
  origin: "Libreville",
  destination: "Paris",
  price_from: 0,
  month_start: firstOfMonth(),
  month_end: lastOfMonth(),
  status: "available",
  description: "",
  conditions: "",
  is_active: true,
});

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
      (supabase.from("flight_programs" as never) as any).select("*").order("created_at", { ascending: false }).limit(300),
      (supabase.from("partner_agencies") as any).select("id,name").eq("category", "avion").eq("is_active", true).order("name"),
    ]);
    setPrograms(((p as any) ?? []) as Program[]);
    setAgencies(((a as any) ?? []) as Agency[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(empty()); setOpen(true); };
  const openEdit = (p: Program) => { setEditing({ ...p }); setOpen(true); };

  const save = async () => {
    if (!editing.agency_id) { toast.error("Sélectionnez une compagnie aérienne"); return; }
    if (!editing.origin?.trim() || !editing.destination?.trim()) { toast.error("Départ et arrivée requis"); return; }
    if (!editing.month_start || !editing.month_end) { toast.error("Période mensuelle requise"); return; }
    setSaving(true);
    const payload: any = {
      agency_id: editing.agency_id,
      origin: editing.origin.trim(),
      destination: editing.destination.trim(),
      price_from: Number(editing.price_from ?? 0),
      month_start: editing.month_start,
      month_end: editing.month_end,
      status: editing.status ?? "available",
      description: editing.description || null,
      conditions: editing.conditions || null,
      is_active: editing.is_active ?? true,
    };
    const q = editing.id
      ? (supabase.from("flight_programs" as never) as any).update(payload).eq("id", editing.id)
      : (supabase.from("flight_programs" as never) as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Programme mis à jour" : "Programme créé");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce programme de vol ?")) return;
    const { error } = await (supabase.from("flight_programs" as never) as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  return (
    <div className="p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Programmes de vols</h1>
            <p className="text-xs text-muted-foreground">
              Le prix « à partir de » est indicatif — le tarif final est envoyé par devis.
            </p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Nouveau programme</Button>
      </header>

      {loading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : programs.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Aucun programme de vol.</p>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {programs.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {agencies.find((a) => a.id === p.agency_id)?.name ?? "Compagnie"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{p.origin} → {p.destination}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDate(p.month_start)} — {fmtDate(p.month_end)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-base font-extrabold text-primary">À partir de {FCFA(p.price_from)}</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
                  {PROGRAM_STATUS_LABEL[p.status] ?? p.status}{p.is_active ? "" : " · masqué"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Modifier le programme" : "Nouveau programme de vol"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Compagnie aérienne</Label>
              <Select value={editing.agency_id ?? ""} onValueChange={(v) => setEditing((e) => ({ ...e, agency_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une compagnie" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {agencies.length === 0 && (
                <p className="mt-1 text-xs text-destructive">
                  Aucune compagnie enregistrée. Ajoutez-en une dans « Agences partenaires » (catégorie Avion).
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Départ (ville / aéroport)</Label>
                <Input value={editing.origin ?? ""} onChange={(e) => setEditing((s) => ({ ...s, origin: e.target.value }))} />
              </div>
              <div>
                <Label>Arrivée (ville / aéroport)</Label>
                <Input value={editing.destination ?? ""} onChange={(e) => setEditing((s) => ({ ...s, destination: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Prix « à partir de » (FCFA, indicatif)</Label>
              <NumericField min={0} value={editing.price_from ?? 0}
                onChange={(v: number) => setEditing((s) => ({ ...s, price_from: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Début de période</Label>
                <Input type="date" value={editing.month_start ?? ""} onChange={(e) => setEditing((s) => ({ ...s, month_start: e.target.value }))} />
              </div>
              <div>
                <Label>Fin de période</Label>
                <Input type="date" value={editing.month_end ?? ""} onChange={(e) => setEditing((s) => ({ ...s, month_end: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={editing.status ?? "available"} onValueChange={(v) => setEditing((e) => ({ ...e, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="full">Complet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description / informations complémentaires</Label>
              <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div>
              <Label>Conditions particulières (optionnel)</Label>
              <Textarea rows={2} value={editing.conditions ?? ""} onChange={(e) => setEditing((s) => ({ ...s, conditions: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label className="mb-0">Visible par les clients</Label>
              <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing((s) => ({ ...s, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
