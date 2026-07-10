import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BadgeCheck, ShieldCheck, ShieldOff, Pencil, Trash2, Plus, Upload, Bus, TrainFront, Plane, Ship } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/agences")({
  component: AdminAgences,
});

type AgencyCategory = "bus" | "train" | "avion" | "bateau";

type Agency = {
  id: string;
  owner_user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  description: string;
  category: AgencyCategory | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
};

const CAT_LABELS: Record<AgencyCategory, string> = {
  bus: "Bus",
  train: "Train",
  avion: "Avion",
  bateau: "Bateau",
};

const CAT_ICONS: Record<AgencyCategory, typeof Bus> = {
  bus: Bus,
  train: TrainFront,
  avion: Plane,
  bateau: Ship,
};

type FormState = {
  id: string | null;
  owner_user_id: string;
  name: string;
  phone: string;
  email: string;
  description: string;
  category: AgencyCategory | "";
  logo_url: string;
};

const emptyForm = (): FormState => ({
  id: null,
  owner_user_id: "",
  name: "",
  phone: "",
  email: "",
  description: "",
  category: "",
  logo_url: "",
});

function AdminAgences() {
  const [list, setList] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_all_partner_agencies_admin");
    if (error) toast.error(error.message);
    setList((data ?? []) as Agency[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (a: Agency) => {
    setForm({
      id: a.id,
      owner_user_id: a.owner_user_id,
      name: a.name,
      phone: a.phone ?? "",
      email: a.email ?? "",
      description: a.description ?? "",
      category: (a.category ?? "") as AgencyCategory | "",
      logo_url: a.logo_url ?? "",
    });
    setShowForm(true);
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `agency-logos/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("ticket-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("ticket-images").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo téléversé");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur upload";
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    if (!form.category) { toast.error("La catégorie est requise"); return; }
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("partner_agencies").update({
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          description: form.description,
          category: form.category,
          logo_url: form.logo_url || null,
        }).eq("id", form.id);
        if (error) throw error;
        toast.success("Agence mise à jour");
      } else {
        if (!form.owner_user_id.trim()) {
          toast.error("Renseignez l'ID du propriétaire (user_id)");
          setSaving(false); return;
        }
        const { error } = await supabase.from("partner_agencies").insert({
          owner_user_id: form.owner_user_id,
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          description: form.description,
          category: form.category,
          logo_url: form.logo_url || null,
          is_active: true,
          is_verified: false,
        });
        if (error) throw error;
        toast.success("Agence créée");
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

  const remove = async (a: Agency) => {
    if (!confirm(`Supprimer l'agence "${a.name}" ?`)) return;
    const { error } = await supabase.from("partner_agencies").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Agence supprimée");
    load();
  };

  const toggleVerified = async (a: Agency) => {
    const { error } = await supabase.from("partner_agencies").update({ is_verified: !a.is_verified }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const toggleActive = async (a: Agency) => {
    const { error } = await supabase.from("partner_agencies").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const grantAgenceRole = async (userId: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "agence" });
    if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
    toast.success("Rôle 'agence' attribué");
  };

  return (
    <div className="mx-auto max-w-6xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agences partenaires</h1>
          <p className="text-sm text-muted-foreground">Créez, modifiez et gérez vos agences (Bus, Train, Avion, Bateau).</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouvelle agence
        </Button>
      </div>

      {showForm && (
        <div className="mt-5 rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">{form.id ? "Modifier l'agence" : "Créer une agence"}</h2>

          {!form.id && (
            <div>
              <label className="text-xs font-medium">ID propriétaire (user_id)</label>
              <Input value={form.owner_user_id} onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })} placeholder="uuid du user Supabase" />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Nom *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Catégorie *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as AgencyCategory | "" })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {(Object.keys(CAT_LABELS) as AgencyCategory[]).map((c) => (
                  <option key={c} value={c}>{CAT_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Téléphone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>

          <div>
            <label className="text-xs font-medium">Logo</label>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="h-16 w-16 rounded-full object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted" />
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "Téléversement…" : "Choisir un logo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
              {form.logo_url && (
                <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, logo_url: "" })}>Retirer</Button>
              )}
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
          Aucune agence partenaire pour le moment.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {list.map((a) => {
            const CatIcon = a.category ? CAT_ICONS[a.category] : Bus;
            return (
              <article key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
                {a.logo_url ? (
                  <img loading="lazy" decoding="async" src={a.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="flex items-center gap-1.5 text-base font-bold">
                    {a.name}
                    {a.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                    {a.category && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <CatIcon className="h-3 w-3" />
                        {CAT_LABELS[a.category]}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground">{a.email ?? "—"} · {a.phone ?? "—"}</p>
                  {a.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>}
                  <p className="text-[10px] text-muted-foreground/70">ID propriétaire : {a.owner_user_id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => grantAgenceRole(a.owner_user_id)}>
                    Rôle agence
                  </Button>
                  <Button size="sm" variant={a.is_verified ? "outline" : "default"} onClick={() => toggleVerified(a)}>
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    {a.is_verified ? "Dévérifier" : "Vérifier"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(a)}>
                    <ShieldOff className="mr-1 h-3.5 w-3.5" />
                    {a.is_active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
