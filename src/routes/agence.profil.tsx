import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/agence/profil")({
  component: AgenceProfil,
});

function AgenceProfil() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", description: "", logo_url: "",
  });
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("get_my_partner_agency");
      const a = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (a) {
        setAgencyId(a.id);
        setForm({
          name: a.name ?? "", phone: a.phone ?? "", email: a.email ?? "",
          description: a.description ?? "", logo_url: a.logo_url ?? "",
        });
      } else {
        setForm((f) => ({ ...f, email: user.email ?? "" }));
      }
      setLoading(false);
    })();
  }, [user]);

  const onLogo = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("partner-tickets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("partner-tickets").getPublicUrl(path);
    setForm((f) => ({ ...f, logo_url: data.publicUrl }));
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    const payload = { ...form, owner_user_id: user.id };
    const { error } = agencyId
      ? await supabase.from("partner_agencies").update(payload).eq("id", agencyId)
      : await supabase.from("partner_agencies").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profil enregistré");
  };

  if (loading) return <p className="text-center text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Profil de l'agence</h1>
      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <div>
          <label className="text-xs font-semibold">Nom de l'agence *</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold">Téléphone</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold">Description</label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-semibold">Logo</label>
          <div className="mt-1 flex items-center gap-3">
            {form.logo_url && <img loading="lazy" decoding="async" src={form.logo_url} alt="" className="h-14 w-14 rounded-full object-cover" />}
            <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); }} />
          </div>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </div>
  );
}
