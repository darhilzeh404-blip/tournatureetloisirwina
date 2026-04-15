import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Map, Plus, Pencil, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/circuits")({
  component: AdminCircuits,
});

type Circuit = {
  id: string;
  nom: string;
  description: string;
  created_at: string;
};

function AdminCircuits() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Circuit | null>(null);
  const [form, setForm] = useState({ nom: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchCircuits = async () => {
    setLoading(true);
    const { data } = await supabase.from("circuits").select("*").order("created_at", { ascending: false });
    setCircuits((data as Circuit[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCircuits(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: "", description: "" });
    setShowForm(true);
  };

  const openEdit = (c: Circuit) => {
    setEditing(c);
    setForm({ nom: c.nom, description: c.description });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nom) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("circuits").update(form).eq("id", editing.id);
        if (error) throw error;
        toast.success("Circuit modifié");
      } else {
        const { error } = await supabase.from("circuits").insert(form);
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
    else { toast.success("Circuit supprimé"); fetchCircuits(); }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Circuits</h1>
          <p className="text-sm text-muted-foreground">Créez et gérez les circuits touristiques</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nouveau circuit
        </button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="p-4">Nom</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Chargement...</td></tr>
              ) : circuits.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Aucun circuit</td></tr>
              ) : (
                circuits.map(c => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{c.nom}</td>
                    <td className="p-4 text-muted-foreground">{c.description || "—"}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 hover:bg-secondary"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? "Modifier" : "Nouveau"} circuit</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1 hover:bg-secondary"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nom</label>
                <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Enregistrement..." : editing ? "Modifier" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
