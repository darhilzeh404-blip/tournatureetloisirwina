import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, X, Users, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/destinations";

export const Route = createFileRoute("/admin/circuits")({
  component: AdminCircuits,
});

type Circuit = {
  id: string;
  slug: string;
  nom: string;
  description: string;
  base_price: number;
  image_url: string | null;
  duration_days: number;
  includes_lodging: boolean;
  includes_guide: boolean;
  lodging_price: number;
  guide_price: number;
  is_active: boolean;
  sort_order: number;
};

type UserRow = { user_id: string; full_name: string; role: string };
type UserCircuit = { id: string; user_id: string; circuit_id: string };
type CircuitActivity = {
  id: string;
  circuit_id: string;
  name: string;
  price: number;
  is_default: boolean;
  sort_order: number;
};

const EMPTY_FORM = {
  slug: "",
  nom: "",
  description: "",
  base_price: 0,
  image_url: "",
  duration_days: 1,
  includes_lodging: false,
  includes_guide: false,
  lodging_price: 15000,
  guide_price: 10000,
  is_active: true,
  sort_order: 0,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AdminCircuits() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Circuit | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Activities subform
  const [actsCircuit, setActsCircuit] = useState<Circuit | null>(null);
  const [acts, setActs] = useState<CircuitActivity[]>([]);
  const [actForm, setActForm] = useState({ name: "", price: 0, is_default: false });

  // Assignment state
  const [assignCircuit, setAssignCircuit] = useState<Circuit | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<UserRow[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [userCircuits, setUserCircuits] = useState<UserCircuit[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchCircuits = async () => {
    setLoading(true);
    const { data } = await supabase.from("circuits").select("*").order("sort_order").order("nom");
    setCircuits((data as Circuit[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCircuits();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (c: Circuit) => {
    setEditing(c);
    setForm({
      slug: c.slug,
      nom: c.nom,
      description: c.description,
      base_price: c.base_price,
      image_url: c.image_url ?? "",
      duration_days: c.duration_days,
      includes_lodging: c.includes_lodging,
      includes_guide: c.includes_guide,
      lodging_price: c.lodging_price,
      guide_price: c.guide_price,
      is_active: c.is_active,
      sort_order: c.sort_order,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nom) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.nom),
        image_url: form.image_url || null,
      };
      if (editing) {
        const { error } = await supabase.from("circuits").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Circuit modifié");
      } else {
        const { error } = await supabase.from("circuits").insert(payload);
        if (error) throw error;
        toast.success("Circuit créé");
      }
      setShowForm(false);
      fetchCircuits();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce circuit ?")) return;
    const { error } = await supabase.from("circuits").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Circuit supprimé");
      fetchCircuits();
    }
  };

  // ---- Activities sub-management
  const openActivities = async (c: Circuit) => {
    setActsCircuit(c);
    setActForm({ name: "", price: 0, is_default: false });
    const { data } = await supabase
      .from("circuit_activities")
      .select("*")
      .eq("circuit_id", c.id)
      .order("sort_order");
    setActs((data as CircuitActivity[]) ?? []);
  };

  const addActivity = async () => {
    if (!actsCircuit || !actForm.name) return;
    const { data, error } = await supabase
      .from("circuit_activities")
      .insert({
        circuit_id: actsCircuit.id,
        name: actForm.name,
        price: actForm.price,
        is_default: actForm.is_default,
        sort_order: acts.length + 1,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setActs((prev) => [...prev, data as CircuitActivity]);
    setActForm({ name: "", price: 0, is_default: false });
  };

  const removeActivity = async (id: string) => {
    const { error } = await supabase.from("circuit_activities").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setActs((prev) => prev.filter((a) => a.id !== id));
  };

  // ---- Assignment
  const openAssign = async (c: Circuit) => {
    setAssignCircuit(c);
    setAssignLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("*");
    const eligibleIds = (roles ?? [])
      .filter((r: any) => r.role === "chauffeur" || r.role === "gerant")
      .map((r: any) => r.user_id);
    if (eligibleIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", eligibleIds);
      const users: UserRow[] = (profiles ?? []).map((p: any) => {
        const r = (roles ?? []).find((r: any) => r.user_id === p.user_id);
        return { user_id: p.user_id, full_name: p.full_name, role: r?.role ?? "" };
      });
      setAssignableUsers(users);
    } else {
      setAssignableUsers([]);
    }
    const { data: uc } = await supabase.from("user_circuits").select("*").eq("circuit_id", c.id);
    const ucList = (uc ?? []) as UserCircuit[];
    setUserCircuits(ucList);
    setAssignedUserIds(new Set(ucList.map((u) => u.user_id)));
    setAssignLoading(false);
  };

  const toggleAssign = async (userId: string) => {
    if (!assignCircuit) return;
    const isAssigned = assignedUserIds.has(userId);
    if (isAssigned) {
      const uc = userCircuits.find((u) => u.user_id === userId && u.circuit_id === assignCircuit.id);
      if (uc) {
        const { error } = await supabase.from("user_circuits").delete().eq("id", uc.id);
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      setAssignedUserIds((prev) => {
        const n = new Set(prev);
        n.delete(userId);
        return n;
      });
      setUserCircuits((prev) => prev.filter((u) => u.user_id !== userId));
      toast.success("Désassigné");
    } else {
      const { data, error } = await supabase
        .from("user_circuits")
        .insert({ user_id: userId, circuit_id: assignCircuit.id })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setAssignedUserIds((prev) => new Set(prev).add(userId));
      setUserCircuits((prev) => [...prev, data as UserCircuit]);
      toast.success("Assigné au circuit");
    }
  };

  const ROLE_LABEL: Record<string, string> = { chauffeur: "Chauffeur", gerant: "Gérant" };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Circuits</h1>
          <p className="text-sm text-muted-foreground">Prix, options, activités et assignation des gérants</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nouveau circuit
        </button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="p-4">Nom</th>
                <th className="p-4">Prix /pers</th>
                <th className="p-4">Options</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : circuits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Aucun circuit
                  </td>
                </tr>
              ) : (
                circuits.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-4">
                      <p className="font-medium">{c.nom}</p>
                      <p className="text-xs text-muted-foreground">{c.description || "—"}</p>
                    </td>
                    <td className="p-4 font-semibold text-primary">{formatFCFA(c.base_price)}</td>
                    <td className="p-4 text-xs">
                      {c.includes_lodging && <span className="mr-1 rounded bg-secondary px-1.5 py-0.5">🛏 {formatFCFA(c.lodging_price)}</span>}
                      {c.includes_guide && <span className="rounded bg-secondary px-1.5 py-0.5">👤 {formatFCFA(c.guide_price)}</span>}
                      {!c.includes_lodging && !c.includes_guide && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {c.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openActivities(c)} className="rounded-lg p-1.5 hover:bg-secondary" title="Activités liées">
                          <Sparkles className="h-4 w-4" />
                        </button>
                        <button onClick={() => openAssign(c)} className="rounded-lg p-1.5 hover:bg-secondary" title="Assigner gérant/chauffeur">
                          <Users className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 hover:bg-secondary">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? "Modifier" : "Nouveau"} circuit</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Nom</label>
                <input value={form.nom} onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Slug (laisser vide pour auto)</label>
                <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder={slugify(form.nom)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Image URL (optionnel)</label>
                <input value={form.image_url} onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Prix /pers (FCFA)</label>
                  <input type="number" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: Number(e.target.value) }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Durée (jours)</label>
                  <input type="number" value={form.duration_days} onChange={(e) => setForm((p) => ({ ...p, duration_days: Number(e.target.value) }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Ordre</label>
                  <input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.includes_lodging} onChange={(e) => setForm((p) => ({ ...p, includes_lodging: e.target.checked }))} />
                  Hébergement disponible
                </label>
                {form.includes_lodging && (
                  <input type="number" value={form.lodging_price} onChange={(e) => setForm((p) => ({ ...p, lodging_price: Number(e.target.value) }))} placeholder="Prix logement /pers" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.includes_guide} onChange={(e) => setForm((p) => ({ ...p, includes_guide: e.target.checked }))} />
                  Guide accompagnateur disponible
                </label>
                {form.includes_guide && (
                  <input type="number" value={form.guide_price} onChange={(e) => setForm((p) => ({ ...p, guide_price: Number(e.target.value) }))} placeholder="Prix guide forfait" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Visible côté client
              </label>
              <button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Enregistrement…" : editing ? "Modifier" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activities sub-modal */}
      {actsCircuit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Activités — {actsCircuit.nom}</h2>
              <button onClick={() => setActsCircuit(null)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {acts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucune activité liée</p>
              ) : (
                acts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {a.name} {a.is_default && <span className="ml-1 text-[10px] text-emerald-600">★ par défaut</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.price > 0 ? `+ ${formatFCFA(a.price)} /pers` : "Inclus"}</p>
                    </div>
                    <button onClick={() => removeActivity(a.id)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-bold uppercase text-muted-foreground">Ajouter une activité</p>
              <input value={actForm.name} onChange={(e) => setActForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nom (ex: Kayak)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              <div className="flex items-center gap-2">
                <input type="number" value={actForm.price} onChange={(e) => setActForm((p) => ({ ...p, price: Number(e.target.value) }))} placeholder="Prix /pers" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={actForm.is_default} onChange={(e) => setActForm((p) => ({ ...p, is_default: e.target.checked }))} />
                  Par défaut
                </label>
              </div>
              <button onClick={addActivity} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment modal */}
      {assignCircuit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Assigner — {assignCircuit.nom}</h2>
              <button onClick={() => setAssignCircuit(null)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            {assignLoading ? (
              <p className="py-8 text-center text-muted-foreground">Chargement…</p>
            ) : assignableUsers.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Aucun chauffeur ou gérant disponible</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {assignableUsers.map((u) => {
                  const checked = assignedUserIds.has(u.user_id);
                  return (
                    <label key={u.user_id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-secondary/50">
                      <input type="checkbox" checked={checked} onChange={() => toggleAssign(u.user_id)} className="h-4 w-4 rounded border-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{u.full_name || "—"}</p>
                        <span className="text-xs text-muted-foreground">{ROLE_LABEL[u.role] ?? u.role}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
