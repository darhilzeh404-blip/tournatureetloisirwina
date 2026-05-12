import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/annonces")({
  component: AdminAnnouncements,
});

type Announcement = {
  id: string;
  title: string;
  description: string;
  type: "promo" | "event" | "alert";
  starts_at: string;
  ends_at: string;
  details_url: string | null;
  is_active: boolean;
};

type FormState = Omit<Announcement, "id"> & { id?: string };

const emptyForm = (): FormState => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  return {
    title: "",
    description: "",
    type: "event",
    starts_at: now.toISOString().slice(0, 16),
    ends_at: end.toISOString().slice(0, 16),
    details_url: "",
    is_active: true,
  };
};

const TYPE_LABELS = { promo: "Promo", event: "Événement", alert: "Alerte" } as const;

function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("starts_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) return toast.error("Titre requis");
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      details_url: form.details_url?.trim() || null,
      is_active: form.is_active,
    };
    const q = form.id
      ? supabase.from("announcements").update(payload).eq("id", form.id)
      : supabase.from("announcements").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Annonce mise à jour" : "Annonce créée");
    setForm(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Annonce supprimée");
    load();
  };

  const edit = (a: Announcement) => {
    setForm({
      id: a.id,
      title: a.title,
      description: a.description,
      type: a.type,
      starts_at: a.starts_at.slice(0, 16),
      ends_at: a.ends_at.slice(0, 16),
      details_url: a.details_url ?? "",
      is_active: a.is_active,
    });
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Annonces & Événements</h1>
        </div>
        <Button onClick={() => setForm(emptyForm())}>
          <Plus className="h-4 w-4" /> Nouvelle annonce
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Aucune annonce.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => {
            const now = Date.now();
            const active = a.is_active && new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() >= now;
            return (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {TYPE_LABELS[a.type]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {active ? "En cours" : a.is_active ? "Programmée" : "Inactive"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.starts_at).toLocaleDateString("fr-FR")} → {new Date(a.ends_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <h3 className="mt-1 font-semibold">{a.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" onClick={() => edit(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">{form.id ? "Modifier l'annonce" : "Nouvelle annonce"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold">Titre</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold">Description</label>
                <textarea
                  className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold">Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as Announcement["type"] })}
                  >
                    <option value="event">Événement</option>
                    <option value="promo">Promo</option>
                    <option value="alert">Alerte</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold">Début</label>
                  <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold">Fin</label>
                  <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Lien "Voir détails" (optionnel)</label>
                <Input value={form.details_url ?? ""} onChange={(e) => setForm({ ...form, details_url: e.target.value })} placeholder="https://… ou /activites" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>Annuler</Button>
              <Button onClick={save}>Enregistrer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
