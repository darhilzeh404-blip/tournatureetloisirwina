import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Upload, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { randomId } from "@/lib/random-id";

export const Route = createFileRoute("/admin/sites-touristiques")({
  component: AdminSitesTouristiques,
});

type Site = {
  id: string;
  name: string;
  slug: string;
  description: string;
  location: string | null;
  price: number;
  images: string[];
  is_active: boolean;
  sort_order: number;
};

type FormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  location: string;
  price: string;
  images: string[];
  is_active: boolean;
  sort_order: string;
};

const emptyForm = (): FormState => ({
  id: null, name: "", slug: "", description: "", location: "",
  price: "0", images: [], is_active: true, sort_order: "0",
});

function slugify(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function AdminSitesTouristiques() {
  const [list, setList] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tourist_sites").select("*").order("sort_order").order("name");
    if (error) toast.error(error.message);
    setList((data ?? []) as Site[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm()); setShowForm(true); };
  const openEdit = (s: Site) => {
    setForm({
      id: s.id, name: s.name, slug: s.slug, description: s.description,
      location: s.location ?? "", price: String(s.price), images: s.images ?? [],
      is_active: s.is_active, sort_order: String(s.sort_order),
    });
    setShowForm(true);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `tourist-sites/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("circuit-images").upload(path, file, {
          cacheControl: "3600", upsert: false, contentType: file.type,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("circuit-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
      toast.success(`${urls.length} image(s) téléversée(s)`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    const slug = form.slug.trim() || slugify(form.name);
    const payload = {
      name: form.name,
      slug,
      description: form.description,
      location: form.location || null,
      price: Number(form.price) || 0,
      images: form.images,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    };
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("tourist_sites").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Site mis à jour");
      } else {
        const { error } = await supabase.from("tourist_sites").insert(payload);
        if (error) throw error;
        toast.success("Site créé");
      }
      setShowForm(false);
      setForm(emptyForm());
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Site) => {
    if (!confirm(`Supprimer le site "${s.name}" ?`)) return;
    const { error } = await supabase.from("tourist_sites").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Site supprimé");
    load();
  };

  const toggleActive = async (s: Site) => {
    const { error } = await supabase.from("tourist_sites").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="mx-auto max-w-6xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sites touristiques</h1>
          <p className="text-sm text-muted-foreground">Gestion des sites touristiques présentés aux clients.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Nouveau site</Button>
      </div>

      {showForm && (
        <div className="mt-5 rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">{form.id ? "Modifier le site" : "Créer un site"}</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Nom *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium">Slug (URL)</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium">Lieu</label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Libreville, Gabon" />
            </div>
            <div>
              <label className="text-xs font-medium">Prix (FCFA)</label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Ordre d'affichage</label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Actif
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          </div>

          <div>
            <label className="text-xs font-medium">Images ({form.images.length})</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.images.map((url, i) => (
                <div key={url} className="relative h-20 w-20">
                  <img src={url} alt="" className="h-20 w-20 rounded object-cover border" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded border border-dashed bg-background text-xs text-muted-foreground hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "…" : "Ajouter"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving || uploading}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm()); }}>Annuler</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucun site touristique. Créez le premier.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {list.map((s) => (
            <article key={s.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 ${!s.is_active ? "opacity-60" : ""}`}>
              {s.images[0] ? (
                <img src={s.images[0]} alt="" className="h-14 w-14 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold">{s.name}</h2>
                <p className="text-xs text-muted-foreground">{s.location ?? "—"} · {s.price.toLocaleString("fr-FR")} FCFA · {s.images.length} photo(s)</p>
                {s.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(s)}><Pencil className="mr-1 h-3.5 w-3.5" /> Modifier</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                  {s.is_active ? <><EyeOff className="mr-1 h-3.5 w-3.5" /> Désactiver</> : <><Eye className="mr-1 h-3.5 w-3.5" /> Activer</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
