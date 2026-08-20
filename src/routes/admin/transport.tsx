import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, Save, Upload, Pencil } from "lucide-react";
import { useTransportData, formatXAF } from "@/hooks/use-transport-data";
import { supabase } from "@/integrations/supabase/client";
import { uploadCatalogImage } from "@/lib/catalog";
import { NumberInput } from "@/components/ui/number-input";

export const Route = createFileRoute("/admin/transport")({
  component: AdminTransport,
});

const TABS = ["Itinéraires", "Véhicules", "Tarifs", "Activités", "Partenaires", "Forfaits", "Paramètres"] as const;
type Tab = typeof TABS[number];

function AdminTransport() {
  const data = useTransportData();
  const [tab, setTab] = useState<Tab>("Itinéraires");

  if (data.loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8">
      <h1 className="text-2xl font-bold">Module Transport</h1>
      <p className="mt-1 text-sm text-muted-foreground">Configurez tarifs, itinéraires, véhicules et activités sans toucher au code.</p>

      <div className="mt-6 flex flex-wrap gap-2 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Itinéraires" && <RoutesTab data={data} />}
        {tab === "Véhicules" && <VehiclesTab data={data} />}
        {tab === "Tarifs" && <PricingTab data={data} />}
        {tab === "Activités" && <ActivitiesTab data={data} />}
        {tab === "Partenaires" && <PartnersTab data={data} />}
        {tab === "Forfaits" && <PackagesTab data={data} />}
        {tab === "Paramètres" && <SettingsTab data={data} />}
      </div>
    </div>
  );
}

// ============ ITINÉRAIRES ============
function RoutesTab({ data }: { data: ReturnType<typeof useTransportData> }) {
  const [form, setForm] = useState({ category_id: "", name: "", origin: "", destination: "", distance_km: 0 });

  const add = async () => {
    if (!form.category_id || !form.name || !form.origin || !form.destination) { toast.error("Champs obligatoires"); return; }
    const { error } = await supabase.from("transport_routes").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Itinéraire ajouté");
    setForm({ category_id: "", name: "", origin: "", destination: "", distance_km: 0 });
    data.reload();
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cet itinéraire et ses tarifs ?")) return;
    const { error } = await supabase.from("transport_routes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé"); data.reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-6">
        <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm md:col-span-1">
          <option value="">Catégorie</option>
          {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm md:col-span-1" />
        <input placeholder="Origine" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <input placeholder="Destination" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <NumberInput placeholder="km" value={form.distance_km} onChange={(v: number) => setForm({ ...form, distance_km: (v || 0) })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <button onClick={add} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Ajouter</button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3 text-left">Catégorie</th><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Origine → Dest.</th><th className="p-3 text-left">km</th><th className="p-3"></th></tr></thead>
          <tbody>
            {data.routes.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{data.categories.find(c => c.id === r.category_id)?.name}</td>
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-muted-foreground">{r.origin} → {r.destination}</td>
                <td className="p-3">{r.distance_km}</td>
                <td className="p-3 text-right"><button onClick={() => del(r.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ VÉHICULES ============
function VehiclesTab({ data }: { data: ReturnType<typeof useTransportData> }) {
  const [form, setForm] = useState({ name: "", capacity: 14, base_price: 50000, description: "" });

  const add = async () => {
    if (!form.name) { toast.error("Nom requis"); return; }
    const { error } = await supabase.from("transport_vehicles").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Véhicule ajouté"); setForm({ name: "", capacity: 14, base_price: 50000, description: "" }); data.reload();
  };
  const del = async (id: string) => {
    if (!confirm("Supprimer ?")) return;
    const { error } = await supabase.from("transport_vehicles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé"); data.reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-5">
        <input placeholder="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm md:col-span-2" />
        <NumberInput placeholder="Places" value={form.capacity} onChange={(v: number) => setForm({ ...form, capacity: (v || 0) })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <NumberInput placeholder="Prix base" value={form.base_price} onChange={(v: number) => setForm({ ...form, base_price: (v || 0) })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <button onClick={add} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Ajouter</button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Places</th><th className="p-3 text-left">Prix base</th><th className="p-3"></th></tr></thead>
          <tbody>
            {data.vehicles.map(v => (
              <tr key={v.id} className="border-t">
                <td className="p-3 font-medium">{v.name}</td>
                <td className="p-3">{v.capacity}</td>
                <td className="p-3">{formatXAF(v.base_price)}</td>
                <td className="p-3 text-right"><button onClick={() => del(v.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ TARIFS (grille) ============
function PricingTab({ data }: { data: ReturnType<typeof useTransportData> }) {
  const [edits, setEdits] = useState<Record<string, number>>({});

  const key = (route_id: string, vehicle_id: string, st: string, tt: string) => `${route_id}|${vehicle_id}|${st}|${tt}`;

  const save = async (route_id: string, vehicle_id: string, st: string, tt: string) => {
    const k = key(route_id, vehicle_id, st, tt);
    const price = edits[k];
    if (price === undefined) return;
    const existing = data.pricing.find(p => p.route_id === route_id && p.vehicle_id === vehicle_id && p.service_type === st && p.trip_type === tt);
    const { error } = existing
      ? await supabase.from("transport_pricing").update({ price }).eq("id", existing.id)
      : await supabase.from("transport_pricing").insert({ route_id, vehicle_id, service_type: st, trip_type: tt, price });
    if (error) { toast.error(error.message); return; }
    toast.success("Tarif enregistré");
    setEdits(e => { const { [k]: _, ...rest } = e; return rest; });
    data.reload();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Définissez le prix par combinaison itinéraire × véhicule × service × trajet.</p>
      {data.routes.map(r => (
        <div key={r.id} className="rounded-xl border bg-card p-4">
          <h3 className="font-bold">{r.name}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Véhicule</th>
                  <th className="p-2">Std / Aller</th>
                  <th className="p-2">Std / A-R</th>
                  <th className="p-2">VIP / Aller</th>
                  <th className="p-2">VIP / A-R</th>
                </tr>
              </thead>
              <tbody>
                {data.vehicles.map(v => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2 font-medium">{v.name}</td>
                    {(["standard", "vip"] as const).flatMap(st =>
                      (["aller_simple", "aller_retour"] as const).map(tt => {
                        const k = key(r.id, v.id, st, tt);
                        const current = data.pricing.find(p => p.route_id === r.id && p.vehicle_id === v.id && p.service_type === st && p.trip_type === tt)?.price ?? 0;
                        const value = edits[k] ?? current;
                        return (
                          <td key={k} className="p-2">
                            <div className="flex items-center gap-1">
                              <NumberInput value={value} onChange={(v: number) => setEdits({ ...edits, [k]: (v || 0) })}
                                className="w-24 rounded border bg-background px-2 py-1" />
                              {edits[k] !== undefined && (
                                <button onClick={() => save(r.id, v.id, st, tt)} className="text-primary"><Save className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ PARTENAIRES ============
const emptyPartner = {
  name: "", description: "", logo_url: "", contact_phone: "", contact_email: "", website: "",
  is_active: true, sort_order: 0,
};

function PartnersTab({ data }: { data: ReturnType<typeof useTransportData> }) {
  const [form, setForm] = useState<typeof emptyPartner>({ ...emptyPartner });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reset = () => { setForm({ ...emptyPartner }); setEditingId(null); };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      logo_url: form.logo_url.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim() || null,
      website: form.website.trim() || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    const { error } = editingId
      ? await supabase.from("activity_partners" as any).update(payload).eq("id", editingId)
      : await supabase.from("activity_partners" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Partenaire mis à jour" : "Partenaire ajouté");
    reset(); data.reload();
  };

  const edit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name ?? "", description: p.description ?? "", logo_url: p.logo_url ?? "",
      contact_phone: p.contact_phone ?? "", contact_email: p.contact_email ?? "",
      website: p.website ?? "", is_active: p.is_active, sort_order: p.sort_order ?? 0,
    });
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce partenaire ? Les activités associées seront détachées.")) return;
    const { error } = await supabase.from("activity_partners" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Partenaire supprimé"); if (editingId === id) reset(); data.reload();
  };

  const onLogo = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCatalogImage(file, "partenaires");
      setForm(f => ({ ...f, logo_url: url }));
    } catch (e: any) { toast.error(e.message ?? "Erreur upload"); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-3">
        <input placeholder="Nom du partenaire *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <input placeholder="Téléphone" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <input placeholder="Email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <input placeholder="Site web" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <NumberInput placeholder="Ordre" value={form.sort_order} onChange={(v: number) => setForm({ ...form, sort_order: v || 0 })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
          Actif
        </label>
        <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-lg border bg-background px-3 py-2 text-sm md:col-span-3" />
        <div className="flex items-center gap-3 md:col-span-2">
          {form.logo_url && <img src={form.logo_url} alt="" className="h-10 w-10 rounded object-contain" />}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
            <Upload className="h-4 w-4" />
            {uploading ? "Envoi…" : "Logo du partenaire"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => onLogo(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={submit} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" />{editingId ? "Enregistrer" : "Ajouter"}
          </button>
          {editingId && <button onClick={reset} className="rounded-lg border px-3 py-2 text-sm">Annuler</button>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3 text-left">Partenaire</th><th className="p-3 text-left">Contact</th><th className="p-3">Activités</th><th className="p-3">Statut</th><th></th></tr></thead>
          <tbody>
            {data.partners.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {p.logo_url && <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-contain" />}
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{[p.contact_phone, p.contact_email].filter(Boolean).join(" · ") || "—"}</td>
                <td className="p-3 text-center">{data.activities.filter(a => a.partner_id === p.id).length}</td>
                <td className="p-3 text-center">{p.is_active ? "Actif" : "Inactif"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => edit(p)} className="mr-3 text-primary"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(p.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {data.partners.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun partenaire pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ ACTIVITÉS ============
const emptyActivity = {
  name: "", description: "", price: 0, duration_hours: 1,
  registration_fee: 10000, partner_id: "", image_url: "", is_active: true,
};

function ActivitiesTab({ data }: { data: ReturnType<typeof useTransportData> }) {
  const [form, setForm] = useState<typeof emptyActivity>({ ...emptyActivity });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reset = () => { setForm({ ...emptyActivity }); setEditingId(null); };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      duration_hours: form.duration_hours,
      registration_fee: form.registration_fee,
      partner_id: form.partner_id || null,
      image_url: form.image_url.trim() || null,
      is_active: form.is_active,
    };
    const { error } = editingId
      ? await supabase.from("transport_activities").update(payload as any).eq("id", editingId)
      : await supabase.from("transport_activities").insert(payload as any);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Activité mise à jour" : "Activité ajoutée");
    reset(); data.reload();
  };

  const edit = (a: any) => {
    setEditingId(a.id);
    setForm({
      name: a.name ?? "", description: a.description ?? "", price: a.price ?? 0,
      duration_hours: a.duration_hours ?? 1, registration_fee: Number(a.registration_fee ?? 0),
      partner_id: a.partner_id ?? "", image_url: a.image_url ?? "", is_active: a.is_active,
    });
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette activité ?")) return;
    const { error } = await supabase.from("transport_activities").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Activité supprimée"); if (editingId === id) reset(); data.reload();
  };

  const onImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCatalogImage(file, "activites");
      setForm(f => ({ ...f, image_url: url }));
    } catch (e: any) { toast.error(e.message ?? "Erreur upload"); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-3">
        <input placeholder="Nom *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <NumberInput allowDecimal placeholder="Durée (h)" value={form.duration_hours} onChange={(v: number) => setForm({ ...form, duration_hours: v || 0 })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <NumberInput placeholder="Prix (FCFA)" value={form.price} onChange={(v: number) => setForm({ ...form, price: v || 0 })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <NumberInput placeholder="Frais d'inscription (FCFA)" value={form.registration_fee} onChange={(v: number) => setForm({ ...form, registration_fee: v || 0 })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <select value={form.partner_id} onChange={e => setForm({ ...form, partner_id: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">Aucun partenaire</option>
          {data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-lg border bg-background px-3 py-2 text-sm md:col-span-3" />
        <div className="flex items-center gap-3 md:col-span-2">
          {form.image_url && <img src={form.image_url} alt="" className="h-10 w-16 rounded object-cover" />}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
            <Upload className="h-4 w-4" />
            {uploading ? "Envoi…" : "Image de l'activité"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => onImage(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={submit} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" />{editingId ? "Enregistrer" : "Ajouter"}
          </button>
          {editingId && <button onClick={reset} className="rounded-lg border px-3 py-2 text-sm">Annuler</button>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Partenaire</th><th className="p-3">Durée</th><th className="p-3">Prix</th><th className="p-3">Inscription</th><th className="p-3">Statut</th><th></th></tr></thead>
          <tbody>
            {data.activities.map(a => (
              <tr key={a.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {a.image_url && <img src={a.image_url} alt="" className="h-8 w-12 rounded object-cover" />}
                    <span className="font-medium">{a.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{data.partners.find(p => p.id === a.partner_id)?.name ?? "—"}</td>
                <td className="p-3 text-center">{a.duration_hours}h</td>
                <td className="p-3 text-center">{formatXAF(a.price)}</td>
                <td className="p-3 text-center">{formatXAF(Number(a.registration_fee ?? 0))}</td>
                <td className="p-3 text-center">{a.is_active ? "Active" : "Inactive"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => edit(a)} className="mr-3 text-primary"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(a.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ FORFAITS ============
function PackagesTab({ data }: { data: ReturnType<typeof useTransportData> }) {
  const [form, setForm] = useState({ name: "", description: "", route_id: "", activity_id: "", price: 0 });
  const add = async () => {
    if (!form.name || !form.price) { toast.error("Nom et prix requis"); return; }
    const { error } = await supabase.from("transport_packages").insert({
      ...form, route_id: form.route_id || null, activity_id: form.activity_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Forfait ajouté"); setForm({ name: "", description: "", route_id: "", activity_id: "", price: 0 }); data.reload();
  };
  const del = async (id: string) => {
    if (!confirm("Supprimer ?")) return;
    await supabase.from("transport_packages").delete().eq("id", id); data.reload();
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-6">
        <input placeholder="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm md:col-span-2" />
        <select value={form.route_id} onChange={e => setForm({ ...form, route_id: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">Itinéraire</option>
          {data.routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={form.activity_id} onChange={e => setForm({ ...form, activity_id: e.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">Activité</option>
          {data.activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <NumberInput placeholder="Prix" value={form.price} onChange={(v: number) => setForm({ ...form, price: (v || 0) })} className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <button onClick={add} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Ajouter</button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Itinéraire</th><th className="p-3 text-left">Activité</th><th className="p-3">Prix</th><th></th></tr></thead>
          <tbody>
            {data.packages.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-muted-foreground">{data.routes.find(r => r.id === p.route_id)?.name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{data.activities.find(a => a.id === p.activity_id)?.name ?? "—"}</td>
                <td className="p-3 text-center font-semibold">{formatXAF(p.price)}</td>
                <td className="p-3 text-right"><button onClick={() => del(p.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ PARAMÈTRES ============
function SettingsTab({ data }: { data: ReturnType<typeof useTransportData> }) {
  const [edits, setEdits] = useState<Record<string, number>>({});
  const settings = Object.entries(data.settings);

  const save = async (key: string) => {
    const value = edits[key];
    if (value === undefined) return;
    const { error } = await supabase.from("transport_settings").update({ value }).eq("key", key);
    if (error) { toast.error(error.message); return; }
    toast.success("Paramètre enregistré");
    setEdits(e => { const { [key]: _, ...rest } = e; return rest; });
    data.reload();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Multiplicateurs et suppléments globaux appliqués au calcul du devis.</p>
      {settings.map(([key, value]) => (
        <div key={key} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex-1">
            <p className="font-medium">{key}</p>
            <p className="text-xs text-muted-foreground">Valeur actuelle : {value}</p>
          </div>
          <NumberInput allowDecimal value={edits[key] ?? Number(value) ?? 0}
            onChange={(v: number) => setEdits({ ...edits, [key]: v })}
            className="w-32 rounded-lg border bg-background px-3 py-2 text-sm" />
          {edits[key] !== undefined && (
            <button onClick={() => save(key)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              <Save className="h-3.5 w-3.5" /> Sauvegarder
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
