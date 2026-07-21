import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BadgeCheck, ShieldCheck, ShieldOff, Pencil, Trash2, Plus, Upload,
  Bus, TrainFront, Plane, Ship, Percent, X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/agences")({
  component: AdminAgences,
});

type AgencyCategory = "bus" | "train" | "avion" | "bateau";

type Agency = {
  id: string;
  owner_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  description: string;
  category: AgencyCategory | null;
  is_verified: boolean;
  is_active: boolean;
  commission_percent: number;
  created_at: string;
};

type CommissionRate = {
  id: string;
  agency_id: string;
  category: string;
  commission_percent: number;
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

const ALL_CATS = Object.keys(CAT_LABELS) as AgencyCategory[];

type FormState = {
  id: string | null;
  name: string;
  description: string;
  category: AgencyCategory | "";
  logo_url: string;
  commission_percent: number;
};

const emptyForm = (): FormState => ({
  id: null,
  name: "",
  description: "",
  category: "",
  logo_url: "",
  commission_percent: 10,
});

function AdminAgences() {
  const [list, setList] = useState<Agency[]>([]);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commissionsFor, setCommissionsFor] = useState<Agency | null>(null);

  const load = async () => {
    setLoading(true);
    const [agenciesRes, ratesRes] = await Promise.all([
      supabase.rpc("get_all_partner_agencies_admin"),
      supabase.from("partner_commission_rates" as any).select("*"),
    ]);
    if (agenciesRes.error) toast.error(agenciesRes.error.message);
    setList(((agenciesRes.data ?? []) as any[]) as Agency[]);
    setRates(((ratesRes.data ?? []) as any[]) as CommissionRate[]);
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
      };
      if (form.id) {
        const { error } = await supabase.from("partner_agencies").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Agence mise à jour");
      } else {
        const { error } = await supabase.from("partner_agencies").insert({
          ...payload,
          owner_user_id: null,
          is_active: true,
          is_verified: false,
        } as any);
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

  return (
    <div className="mx-auto max-w-6xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agences partenaires</h1>
          <p className="text-sm text-muted-foreground">Créez et gérez les agences (Bus, Train, Avion, Bateau) et leurs commissions.</p>
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
              <label className="text-xs font-medium">Commission par défaut (%)</label>
              <Input
                type="number" min={0} max={100} step={0.5}
                value={form.commission_percent}
                onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Appliquée à toutes les ventes de l'agence, sauf catégorie surchargée.
              </p>
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
            const agencyRates = rates.filter((r) => r.agency_id === a.id);
            return (
              <article key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
                {a.logo_url ? (
                  <img loading="lazy" decoding="async" src={a.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="flex flex-wrap items-center gap-1.5 text-base font-bold">
                    {a.name}
                    {a.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                    {a.category && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <CatIcon className="h-3 w-3" />
                        {CAT_LABELS[a.category]}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      <Percent className="h-3 w-3" />
                      {Number(a.commission_percent ?? 10)}% par défaut
                    </span>
                  </h2>
                  {a.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>}
                  {agencyRates.length > 0 && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Surcharges : {agencyRates.map((r) => `${r.category} ${r.commission_percent}%`).join(" · ")}
                    </p>
                  )}
                </div>
     <Button size="sm" variant="outline" asChild>
  <Link to="/admin/agences/$id/billets" params={{ id: a.id }}>
    Billets
  </Link>
</Button>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCommissionsFor(a)}>
                    <Percent className="mr-1 h-3.5 w-3.5" /> Commissions
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

      {commissionsFor && (
        <CommissionEditor
          agency={commissionsFor}
          initialRates={rates.filter((r) => r.agency_id === commissionsFor.id)}
          onClose={() => { setCommissionsFor(null); load(); }}
        />
      )}
    </div>
  );
}

function CommissionEditor({
  agency, initialRates, onClose,
}: { agency: Agency; initialRates: CommissionRate[]; onClose: () => void }) {
  const [rows, setRows] = useState<Record<string, number | "">>(() => {
    const map: Record<string, number | ""> = {};
    ALL_CATS.forEach((c) => {
      const found = initialRates.find((r) => r.category === c);
      map[c] = found ? Number(found.commission_percent) : "";
    });
    return map;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      for (const c of ALL_CATS) {
        const v = rows[c];
        const existing = initialRates.find((r) => r.category === c);
        if (v === "" || v === null || Number.isNaN(Number(v))) {
          if (existing) {
            await supabase.from("partner_commission_rates" as any).delete().eq("id", existing.id);
          }
        } else {
          if (existing) {
            await supabase.from("partner_commission_rates" as any)
              .update({ commission_percent: Number(v) }).eq("id", existing.id);
          } else {
            await supabase.from("partner_commission_rates" as any).insert({
              agency_id: agency.id, category: c, commission_percent: Number(v),
            } as any);
          }
        }
      }
      toast.success("Commissions enregistrées");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Commissions — {agency.name}</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Laissez vide pour appliquer le taux par défaut ({Number(agency.commission_percent ?? 10)}%).
        </p>
        <div className="space-y-2">
          {ALL_CATS.map((c) => {
            const Icon = CAT_ICONS[c];
            return (
              <div key={c} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-24 text-sm">
                  <Icon className="h-4 w-4" /> {CAT_LABELS[c]}
                </div>
                <Input
                  type="number" min={0} max={100} step={0.5}
                  placeholder="par défaut"
                  value={rows[c] === "" ? "" : String(rows[c])}
                  onChange={(e) => setRows({ ...rows, [c]: e.target.value === "" ? "" : Number(e.target.value) })}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
        </div>
      </div>
    </div>
  );
}
