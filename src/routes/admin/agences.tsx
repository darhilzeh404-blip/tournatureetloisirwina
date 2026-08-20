import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BadgeCheck, ShieldCheck, ShieldOff, Pencil, Trash2, Plus, Upload,
  Bus, TrainFront, Plane, Ship, PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import { randomId } from "@/lib/random-id";
import { AgencyLogo } from "@/components/AgencyLogo";
import { NumericField } from "@/components/ui/numeric-field";

export const Route = createFileRoute("/admin/agences")({
  component: AdminAgences,
});

type AgencyCategory = "bus" | "train" | "avion" | "bateau" | "evenement";

type Agency = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string;
  category: AgencyCategory | null;
  is_verified: boolean;
  is_active: boolean;
  commission_percent: number;
  created_at: string;
};

const CAT_LABELS: Record<AgencyCategory, string> = {
  bus: "Bus",
  train: "Train",
  avion: "Avion",
  bateau: "Bateau / Ferry",
  evenement: "Événement",
};

const CAT_ICONS: Record<AgencyCategory, typeof Bus> = {
  bus: Bus,
  train: TrainFront,
  avion: Plane,
  bateau: Ship,
  evenement: PartyPopper,
};

const ALL_CATS = Object.keys(CAT_LABELS) as AgencyCategory[];

type FormState = {
  id: string | null;
  name: string;
  description: string;
  category: AgencyCategory | "";
  logo_url: string;
  commission_percent: number;
  is_active: boolean;
  is_verified: boolean;
};

const emptyForm = (): FormState => ({
  id: null,
  name: "",
  description: "",
  category: "",
  logo_url: "",
  commission_percent: 10,
  is_active: true,
  is_verified: false,
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
    setList(((data ?? []) as any[]) as Agency[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm()); setShowForm(true); };

  const openEdit = (a: Agency) => {
    setForm({
      id: a.id,
      name: a.name,
      description: a.description ?? "",
      category: (a.category ?? "") as AgencyCategory | "",
      logo_url: a.logo_url ?? "",
      commission_percent: Number(a.commission_percent ?? 10),
      is_active: a.is_active,
      is_verified: a.is_verified,
    });
    setShowForm(true);
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `agency-logos/${randomId("logo")}.${ext}`;
      const { error } = await supabase.storage.from("ticket-images").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("ticket-images").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo téléversé");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur upload");
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
      const payload: any = {
        name: form.name,
        description: form.description,
        category: form.category,
        logo_url: form.logo_url || null,
        commission_percent: form.commission_percent,
        is_active: form.is_active,
        is_verified: form.is_verified,
      };
      if (form.id) {
        const { error } = await supabase.from("partner_agencies").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Agence mise à jour");
      } else {
        const { error } = await supabase.from("partner_agencies").insert(payload);
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
    if (!confirm(
      `Supprimer l'agence "${a.name}" ?\n\nCela supprimera aussi ses navires, trajets et programmes de vols associés.`,
    )) return;
    const { error } = await supabase.rpc("admin_delete_partner_agency" as never, {
      _agency_id: a.id,
    } as never);
    if (error) {
      toast.error(
        error.message.includes("Accès refusé")
          ? "Action réservée aux administrateurs"
          : `Suppression impossible : ${error.message}`,
      );
      return;
    }
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

  return (
    <div className="mx-auto max-w-6xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agences partenaires</h1>
          <p className="text-sm text-muted-foreground">
            Créez et gérez les agences (Bus, Train, Avion, Bateau/Ferry, Événement).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouvelle agence
        </Button>
      </div>

      {showForm && (
        <div className="mt-5 rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">{form.id ? "Modifier l'agence" : "Créer une agence"}</h2>

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
                {ALL_CATS.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Commission (%)</label>
              <NumericField min={0} max={100} step={0.5}
                value={form.commission_percent}
                onChange={(v: number) => setForm({ ...form, commission_percent: v })}
              />
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
                <AgencyLogo src={form.logo_url} alt="logo" size={64} />
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

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_verified}
                onChange={(e) => setForm({ ...form, is_verified: e.target.checked })} />
              Vérifiée
            </label>
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
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border bg-card p-4">
                {a.logo_url ? (
                  <AgencyLogo src={a.logo_url} alt={a.name} size={64} />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CatIcon className="h-7 w-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{a.name}</p>
                    {a.is_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                        <BadgeCheck className="h-3 w-3" /> Vérifiée
                      </span>
                    )}
                    {!a.is_active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">Inactive</span>
                    )}
                    {a.category && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">
                        {CAT_LABELS[a.category]}
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                      Commission {a.commission_percent}%
                    </span>
                  </div>
                  {a.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleVerified(a)}>
                    {a.is_verified ? <><ShieldOff className="h-3.5 w-3.5 mr-1" /> Retirer</> : <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Vérifier</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(a)}>
                    {a.is_active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(a)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
