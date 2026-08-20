import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Save, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchLevels, type VipLevel, formatCoins } from "@/lib/wina-coins";
import { VipBadge } from "@/components/wina-coins/VipBadge";
import { NumericField } from "@/components/ui/numeric-field";

type Draft = {
  id?: string;
  level_name: string;
  min_coins: number;
  bonus_percentage: number;
  badge_icon: string;
  sort_order: number;
  description: string;
  benefitsText: string; // one benefit per line
};

const emptyDraft: Draft = {
  level_name: "",
  min_coins: 0,
  bonus_percentage: 0,
  badge_icon: "⭐",
  sort_order: 0,
  description: "",
  benefitsText: "",
};

function toDraft(l: VipLevel): Draft {
  return {
    id: l.id,
    level_name: l.level_name,
    min_coins: l.min_coins,
    bonus_percentage: l.bonus_percentage,
    badge_icon: l.badge_icon,
    sort_order: l.sort_order,
    description: (l as VipLevel & { description?: string | null }).description ?? "",
    benefitsText: (l.benefits ?? []).join("\n"),
  };
}

export function AdminLevelsManager() {
  const [levels, setLevels] = useState<VipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const lv = await fetchLevels();
    setLevels(lv);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const startCreate = () => {
    const nextOrder = (levels.reduce((m, l) => Math.max(m, l.sort_order), 0) || 0) + 1;
    setDraft({ ...emptyDraft, sort_order: nextOrder });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.level_name.trim()) return toast.error("Nom du palier requis");
    setSaving(true);
    const benefits = draft.benefitsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      level_name: draft.level_name.trim(),
      min_coins: Number(draft.min_coins) || 0,
      bonus_percentage: Number(draft.bonus_percentage) || 0,
      badge_icon: draft.badge_icon.trim() || "⭐",
      sort_order: Number(draft.sort_order) || 0,
      description: draft.description.trim() || null,
      benefits,
    };
    const table = supabase.from("vip_levels" as never) as unknown as {
      update: (v: typeof payload) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
      insert: (v: typeof payload) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = draft.id
      ? await table.update(payload).eq("id", draft.id)
      : await table.insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "Palier mis à jour" : "Palier créé");
    setDraft(null);
    await load();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Supprimer le palier "${name}" ?`)) return;
    const { error } = await (supabase.from("vip_levels" as never) as unknown as {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    })
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Palier supprimé");
    await load();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Paliers VIP Wina Coins</h2>
            <p className="text-xs text-muted-foreground">
              Gérez les paliers de fidélité : nom, seuil, bonus, description et récompenses.
            </p>
          </div>
          {!draft && (
            <Button size="sm" onClick={startCreate}>
              <Plus className="mr-1 h-4 w-4" /> Nouveau palier
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {levels.map((l) => {
              const desc = (l as VipLevel & { description?: string | null }).description;
              return (
                <div
                  key={l.id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3"
                >
                  <div className="flex items-start gap-3">
                    <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
                    <VipBadge level={l.level_name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-bold">{l.level_name}</p>
                        <span className="text-[11px] text-muted-foreground">
                          ≥ {formatCoins(l.min_coins)} coins · Bonus {l.bonus_percentage}%
                        </span>
                      </div>
                      {desc && (
                        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                      )}
                      {l.benefits.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                          {l.benefits.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="outline" onClick={() => setDraft(toDraft(l))}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => remove(l.id, l.level_name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {levels.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun palier configuré.</p>
            )}
          </div>
        )}

        {draft && (
          <div className="space-y-3 rounded-xl border bg-secondary/40 p-4">
            <h3 className="text-sm font-bold">
              {draft.id ? "Modifier le palier" : "Nouveau palier"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">
                Nom
                <Input
                  value={draft.level_name}
                  onChange={(e) => setDraft({ ...draft, level_name: e.target.value })}
                  placeholder="Silver, Gold, Platinum…"
                />
              </label>
              <label className="text-xs font-medium">
                Icône (emoji)
                <Input
                  value={draft.badge_icon}
                  onChange={(e) => setDraft({ ...draft, badge_icon: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium">
                Seuil (min. coins cumulés)
                <NumericField
                  value={draft.min_coins}
                  onChange={(v: number) => setDraft({ ...draft, min_coins: v })}
                />
              </label>
              <label className="text-xs font-medium">
                Bonus (%)
                <NumericField
                  value={draft.bonus_percentage}
                  onChange={(v: number) => setDraft({ ...draft, bonus_percentage: v })}
                />
              </label>
              <label className="text-xs font-medium">
                Ordre d'affichage
                <NumericField
                  value={draft.sort_order}
                  onChange={(v: number) => setDraft({ ...draft, sort_order: v })}
                />
              </label>
            </div>
            <label className="block text-xs font-medium">
              Description
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                placeholder="Décrivez le contenu et les conditions du palier"
              />
            </label>
            <label className="block text-xs font-medium">
              Récompenses / avantages (une par ligne)
              <Textarea
                value={draft.benefitsText}
                onChange={(e) => setDraft({ ...draft, benefitsText: e.target.value })}
                rows={4}
                placeholder={"Ex :\n- 5% de bonus sur chaque réservation\n- Accès prioritaire VTC\n- Cadeau d'anniversaire"}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                <X className="mr-1 h-4 w-4" /> Annuler
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save className="mr-1 h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
