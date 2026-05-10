import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, Download, KeyRound, X, Car, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vtc-chauffeurs")({
  head: () => ({ meta: [{ title: "VTC Chauffeurs — Admin" }] }),
  component: AdminVtcChauffeurs,
});

const COMMISSION = 0.2;
const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
const VEHICLE_TYPES = ["Sedan", "SUV", "Berline", "Van", "Pickup"];

type Driver = {
  id: string;
  user_id: string;
  full_name: string;
  vehicle_type: string;
  license_plate: string;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

type DayStat = { trips: number; gross: number };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 16);
}
function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = ""; for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)]; return p;
}

function AdminVtcChauffeurs() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<Record<string, DayStat>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "actif" | "inactif">("all");
  const [filterBusy, setFilterBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: ds } = await supabase.from("drivers" as any).select("*").order("created_at", { ascending: false });
    setDrivers((ds as any) ?? []);
    await loadStats((ds as any) ?? []);
    setLoading(false);
  };

  const loadStats = async (list: Driver[]) => {
    if (!list.length) { setStats({}); return; }
    const today = new Date().toISOString().slice(0, 10);
    const ids = list.map((d) => d.user_id);
    const { data } = await supabase
      .from("trips")
      .select("driver_id, status, completed_at, reservations!inner(service_type, total_amount)")
      .in("driver_id", ids)
      .eq("status", "completed")
      .gte("completed_at", `${today}T00:00:00Z`);
    const map: Record<string, DayStat> = {};
    (data ?? []).forEach((t: any) => {
      if (t.reservations?.service_type !== "VTC") return;
      const k = t.driver_id;
      if (!map[k]) map[k] = { trips: 0, gross: 0 };
      map[k].trips += 1;
      map[k].gross += t.reservations?.total_amount ?? 0;
    });
    setStats(map);
  };

  useEffect(() => { load(); }, []);

  // realtime: refresh stats on completed trip
  useEffect(() => {
    const ch = supabase
      .channel("admin-vtc-trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadStats(drivers))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [drivers]);

  const filtered = useMemo(() => drivers.filter((d) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterBusy && (stats[d.user_id]?.trips ?? 0) <= 10) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.full_name.toLowerCase().includes(q) && !d.license_plate.toLowerCase().includes(q) && !d.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [drivers, stats, filterStatus, filterBusy, search]);

  const toggleStatus = async (d: Driver) => {
    const ns = d.status === "actif" ? "inactif" : "actif";
    const { error } = await supabase.from("drivers" as any).update({ status: ns }).eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success(`Statut: ${ns}`); load(); }
  };

  const removeDriver = async (d: Driver) => {
    if (!confirm(`Supprimer le chauffeur ${d.full_name} ? (Le compte auth restera)`)) return;
    const { error } = await supabase.from("drivers" as any).delete().eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  const resetPassword = async (d: Driver) => {
    if (!d.email) { toast.error("Pas d'email"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(d.email);
    if (error) toast.error(error.message); else toast.success(`Email envoyé à ${d.email}`);
  };

  const exportCSV = () => {
    const rows = [
      ["Nom", "Véhicule", "Immat.", "Téléphone", "Email", "Statut", "Courses/jour", "Net/jour FCFA"],
      ...filtered.map((d) => {
        const s = stats[d.user_id] ?? { trips: 0, gross: 0 };
        return [d.full_name, d.vehicle_type, d.license_plate, d.phone ?? "", d.email ?? "", d.status, String(s.trips), String(Math.round(s.gross * (1 - COMMISSION)))];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `vtc-chauffeurs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-6 lg:pl-72">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="h-6 w-6 text-primary" /> VTC Chauffeurs</h1>
            <p className="text-sm text-zinc-400">{drivers.length} chauffeurs · Commission {COMMISSION * 100}%</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={load} className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"><RefreshCw className="h-4 w-4" /></Button>
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          </div>
        </header>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, immat, email..." className="pl-9 bg-zinc-950 border-zinc-800 text-zinc-100" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="h-9 rounded-md bg-zinc-950 border border-zinc-800 px-2 text-sm">
              <option value="all">Tous statuts</option><option value="actif">Actif</option><option value="inactif">Inactif</option>
            </select>
            <label className="flex items-center gap-2 text-sm px-2">
              <input type="checkbox" checked={filterBusy} onChange={(e) => setFilterBusy(e.target.checked)} /> &gt;10 courses/jour
            </label>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-zinc-400 text-center py-12">Chargement…</p>
        ) : filtered.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-12 text-center text-zinc-400">Aucun chauffeur</CardContent></Card>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="grid gap-3 sm:hidden">
              {filtered.map((d) => {
                const s = stats[d.user_id] ?? { trips: 0, gross: 0 };
                const net = s.gross * (1 - COMMISSION);
                return (
                  <Card key={d.id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{d.full_name}</p>
                          <p className="text-xs text-zinc-400">{d.vehicle_type} · {d.license_plate}</p>
                        </div>
                        <Badge className={d.status === "actif" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-300"}>{d.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-zinc-950 rounded p-2"><p className="text-zinc-500">Courses/j</p><p className="font-bold text-base">{s.trips}</p></div>
                        <div className="bg-zinc-950 rounded p-2"><p className="text-zinc-500">Net/j</p><p className="font-bold text-base text-primary">{FCFA(net)}</p></div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1 border-zinc-700 bg-zinc-950" onClick={() => setDetailDriver(d)}>Détails</Button>
                        <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-950" onClick={() => setEditDriver(d)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-950" onClick={() => resetPassword(d)}><KeyRound className="h-3 w-3" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop: table */}
            <Card className="hidden sm:block bg-zinc-900 border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-950 text-zinc-400">
                    <tr>
                      <th className="text-left px-3 py-2">Nom</th>
                      <th className="text-left px-3 py-2">Véhicule</th>
                      <th className="text-left px-3 py-2">Immat.</th>
                      <th className="text-left px-3 py-2">Téléphone</th>
                      <th className="text-left px-3 py-2">Email</th>
                      <th className="text-left px-3 py-2">Statut</th>
                      <th className="text-right px-3 py-2">Courses/j</th>
                      <th className="text-right px-3 py-2">Net/j</th>
                      <th className="text-right px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const s = stats[d.user_id] ?? { trips: 0, gross: 0 };
                      const net = s.gross * (1 - COMMISSION);
                      return (
                        <tr key={d.id} className="border-t border-zinc-800 hover:bg-zinc-950/50">
                          <td className="px-3 py-2 font-medium">{d.full_name}</td>
                          <td className="px-3 py-2 text-zinc-400">{d.vehicle_type}</td>
                          <td className="px-3 py-2 font-mono text-xs">{d.license_plate}</td>
                          <td className="px-3 py-2 text-zinc-400">{d.phone || "—"}</td>
                          <td className="px-3 py-2 text-zinc-400 text-xs">{d.email}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => toggleStatus(d)} className={`px-2 py-0.5 rounded text-xs ${d.status === "actif" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-300"}`}>{d.status}</button>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{s.trips}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-primary font-semibold">{FCFA(net)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetailDriver(d)}><Eye className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditDriver(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resetPassword(d)}><KeyRound className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeDriver(d)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {showCreate && <CreateDriverModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} existing={drivers} />}
      {detailDriver && <DriverDetailModal driver={detailDriver} onClose={() => setDetailDriver(null)} />}
      {editDriver && <EditDriverModal driver={editDriver} onClose={() => setEditDriver(null)} onSaved={() => { setEditDriver(null); load(); }} />}
    </div>
  );
}

/* ===== Validation helpers ===== */
// Gabon phone: +241 followed by 8 or 9 digits, or local 0X XXXXXXXX (9 digits total starting with 0)
const PHONE_RE = /^(?:\+241\s?\d{8,9}|0\d{8})$/;
const PLATE_RE = /^[A-Z0-9]{2,4}[\s-]?\d{2,4}[\s-]?[A-Z0-9]{1,3}$/;
function normalizePhone(v: string) { return v.replace(/[^\d+]/g, ""); }
function normalizePlate(v: string) { return v.toUpperCase().replace(/[^A-Z0-9\s-]/g, ""); }
function validatePhone(v: string) { return v === "" || PHONE_RE.test(v.replace(/\s/g, "")) ? "" : "Format: +241XXXXXXXX ou 0XXXXXXXX"; }
function validatePlate(v: string) { return PLATE_RE.test(v.trim()) ? "" : "Format invalide (ex: AB 123 GA)"; }

/* ===== Create Modal ===== */
function CreateDriverModal({ onClose, onCreated, existing }: { onClose: () => void; onCreated: () => void; existing: Driver[] }) {
  const [form, setForm] = useState({ full_name: "", vehicle_type: "Sedan", license_plate: "", phone: "" });
  const [password, setPassword] = useState(genPassword());
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const email = useMemo(() => {
    const n = slugify(form.full_name); const p = slugify(form.license_plate);
    return n && p ? `${n}.${p}@vtc.app` : "";
  }, [form.full_name, form.license_plate]);

  const plateErr = form.license_plate ? validatePlate(form.license_plate) : "";
  const phoneErr = validatePhone(form.phone);

  const submit = async () => {
    if (!form.full_name || !form.license_plate) { toast.error("Nom et immatriculation requis"); return; }
    if (plateErr) { toast.error(`Immatriculation: ${plateErr}`); return; }
    if (phoneErr) { toast.error(`Téléphone: ${phoneErr}`); return; }
    if (!form.phone) { toast.error("Téléphone requis"); return; }
    if (existing.some((d) => d.license_plate.toUpperCase() === form.license_plate.toUpperCase())) { toast.error("Immatriculation déjà utilisée"); return; }
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Session admin manquante");
      const res = await fetch("/api/admin/create-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, email, password }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erreur");
      toast.success("Chauffeur créé");
      onCreated();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Nouveau chauffeur VTC</h2>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <Input placeholder="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-zinc-950 border-zinc-800" />
          <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-sm">
            {VEHICLE_TYPES.map((v) => <option key={v}>{v}</option>)}
          </select>
          <Input placeholder="Immatriculation" value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value.toUpperCase() })} className="bg-zinc-950 border-zinc-800 font-mono" />
          <Input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-zinc-950 border-zinc-800" />
          <div>
            <p className="text-xs text-zinc-400 mb-1">Email généré</p>
            <Input readOnly value={email || "—"} className="bg-zinc-950 border-zinc-800 text-primary" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">Mot de passe</p>
            <div className="flex gap-1">
              <Input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-zinc-950 border-zinc-800 font-mono" />
              <Button size="icon" variant="outline" className="border-zinc-700 bg-zinc-950" onClick={() => setShowPwd(!showPwd)}>{showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              <Button size="icon" variant="outline" className="border-zinc-700 bg-zinc-950" onClick={() => setPassword(genPassword())}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
          <Button onClick={submit} disabled={busy || !email} className="w-full">{busy ? "Création…" : "Créer le chauffeur"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ===== Edit Modal ===== */
function EditDriverModal({ driver, onClose, onSaved }: { driver: Driver; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: driver.full_name, vehicle_type: driver.vehicle_type, license_plate: driver.license_plate, phone: driver.phone ?? "", status: driver.status });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("drivers" as any).update(form).eq("id", driver.id);
    if (error) toast.error(error.message); else { toast.success("Modifié"); onSaved(); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Modifier le chauffeur</h2>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-zinc-500 -mt-1">{driver.email}</p>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Nom complet</label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-zinc-950 border-zinc-800" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Type de véhicule</label>
            <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-sm">
              {VEHICLE_TYPES.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Immatriculation</label>
            <Input value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value.toUpperCase() })} className="bg-zinc-950 border-zinc-800 font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Téléphone</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-zinc-950 border-zinc-800" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Statut</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-sm">
              <option value="actif">Actif</option><option value="inactif">Inactif</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 border-zinc-700 bg-zinc-950">Annuler</Button>
            <Button onClick={save} disabled={busy || !form.full_name || !form.license_plate} className="flex-1">{busy ? "…" : "Enregistrer"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ===== Detail Modal ===== */
function DriverDetailModal({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = async () => {
    setLoading(true);
    const now = new Date();
    let from = new Date(now); from.setHours(0, 0, 0, 0);
    if (period === "week") from.setDate(now.getDate() - 7);
    if (period === "month") from.setDate(now.getDate() - 30);
    const { data } = await supabase
      .from("trips")
      .select("id, completed_at, status, reservations!inner(service_type, total_amount)")
      .eq("driver_id", driver.user_id)
      .eq("status", "completed")
      .gte("completed_at", from.toISOString())
      .order("completed_at", { ascending: false });
    setTrips((data ?? []).filter((t: any) => t.reservations?.service_type === "VTC"));
    setLoading(false);
  };

  useEffect(() => { loadTrips(); }, [period]);
  useEffect(() => {
    const ch = supabase.channel(`driver-detail-${driver.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `driver_id=eq.${driver.user_id}` }, () => loadTrips())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driver.user_id, period]);

  const gross = trips.reduce((s, t) => s + (t.reservations?.total_amount ?? 0), 0);
  const net = gross * (1 - COMMISSION);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <Card className="bg-zinc-900 border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-bold text-lg">{driver.full_name}</h2>
              <p className="text-sm text-zinc-400">{driver.vehicle_type} · <span className="font-mono">{driver.license_plate}</span></p>
              <p className="text-xs text-zinc-500">{driver.email} · {driver.phone}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>

          <div className="flex gap-1 bg-zinc-950 rounded p-1">
            {(["day", "week", "month"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`flex-1 px-3 py-1.5 text-xs rounded ${period === p ? "bg-primary text-primary-foreground" : "text-zinc-400"}`}>
                {p === "day" ? "Jour" : p === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-950 rounded p-3"><p className="text-[10px] uppercase text-zinc-500">Courses</p><p className="text-xl font-bold">{trips.length}</p></div>
            <div className="bg-zinc-950 rounded p-3"><p className="text-[10px] uppercase text-zinc-500">Brut</p><p className="text-xl font-bold">{FCFA(gross)}</p></div>
            <div className="bg-zinc-950 rounded p-3"><p className="text-[10px] uppercase text-zinc-500">Net</p><p className="text-xl font-bold text-primary">{FCFA(net)}</p></div>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto">
            {loading ? <p className="text-center text-zinc-400 py-4">Chargement…</p> :
             trips.length === 0 ? <p className="text-center text-zinc-500 py-6 text-sm">Aucune course</p> :
             trips.map((t) => {
               const g = t.reservations?.total_amount ?? 0;
               return (
                 <div key={t.id} className="flex justify-between items-center bg-zinc-950 rounded p-2 text-sm">
                   <span className="text-zinc-400 text-xs">{new Date(t.completed_at).toLocaleString("fr-FR")}</span>
                   <span className="font-semibold text-primary">{FCFA(g * (1 - COMMISSION))}</span>
                 </div>
               );
             })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
