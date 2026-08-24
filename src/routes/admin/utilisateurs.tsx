import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Pencil, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { VirtualTableBody } from "@/components/ui/virtual-list";

export const Route = createFileRoute("/admin/utilisateurs")({
  component: AdminUtilisateurs,
});

type UserRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  role: string;
};

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-destructive/10 text-destructive" },
  gerant: { label: "Gérant", cls: "bg-accent/10 text-accent-foreground" },
  chauffeur: { label: "Chauffeur", cls: "bg-primary/10 text-primary" },
  client: { label: "Client", cls: "bg-secondary text-secondary-foreground" },
};

function AdminUtilisateurs() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("all");
  const [search, setSearch] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", role: "client", password: "" });

  // Edit modal
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", role: "" });
  const [editSaving, setEditSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    // Bornage : sans `.limit()`, une base volumineuse renvoyait des milliers de
    // lignes d'un coup et bloquait la WebView Android au rendu.
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("user_roles").select("user_id, role").limit(2000),
    ]);
    if (profiles && roles) {
      // Index O(1) au lieu d'un `find()` par profil (coût O(n x m)).
      const roleByUser = new Map<string, string>();
      for (const r of roles as any[]) if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);
      const merged: UserRow[] = profiles.map((p: any) => {
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          status: p.status ?? "actif",
          role: roleByUser.get(p.user_id) ?? "client",
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Create user (via secure backend endpoint — does NOT touch admin session)
  const handleCreate = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    if (newUser.password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          role: newUser.role,
        },
      });
      if (error) throw new Error(error.message || "Erreur");
      if (!data?.success) throw new Error(data?.error || "Erreur");


      toast.success("Utilisateur créé");
      setShowCreate(false);
      setNewUser({ full_name: "", email: "", role: "client", password: "" });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setCreating(false);
    }
  };

  // Edit user
  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name, role: u.role });
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      // Update profile name
      if (editForm.full_name !== editUser.full_name) {
        const { error } = await supabase
          .from("profiles")
          .update({ full_name: editForm.full_name })
          .eq("user_id", editUser.user_id);
        if (error) throw error;
      }
      // Update role
      if (editForm.role !== editUser.role) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: editForm.role as any })
          .eq("user_id", editUser.user_id);
        if (error) throw error;
      }
      toast.success("Utilisateur modifié");
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Toggle status
  const toggleStatus = async (u: UserRow) => {
    const newStatus = u.status === "actif" ? "inactif" : "actif";
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("user_id", u.user_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Utilisateur ${newStatus === "actif" ? "activé" : "désactivé"}`);
      setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, status: newStatus } : x));
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Gérez tous les utilisateurs de la plateforme</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Créer un utilisateur
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="all">Tous les rôles</option>
          <option value="admin">Admin</option>
          <option value="gerant">Gérant</option>
          <option value="chauffeur">Chauffeur</option>
          <option value="client">Client</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="p-4">Nom</th>
                <th className="p-4">Email</th>
                <th className="p-4">Rôle</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            {loading || filtered.length === 0 ? (
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Chargement...</td></tr>
                ) : (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucun utilisateur</td></tr>
                )}
              </tbody>
            ) : (
              <VirtualTableBody
                items={filtered}
                colSpan={5}
                estimateRowHeight={65}
                renderRow={(u) => {
                  const rl = ROLE_LABELS[u.role] ?? ROLE_LABELS.client;
                  return (
                    <tr key={u.user_id} className="border-b last:border-0">
                      <td className="p-4 font-medium">{u.full_name || "—"}</td>
                      <td className="p-4 text-muted-foreground">{u.email || "—"}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${rl.cls}`}>{rl.label}</span>
                      </td>
                      <td className="p-4">
                        <Switch checked={u.status === "actif"} onCheckedChange={() => toggleStatus(u)} />
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 hover:bg-secondary">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                }}
              />
            )}
          </table>
        </CardContent>
      </Card>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Créer un utilisateur</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-secondary"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nom complet</label>
                <input value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Jean Ndong" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email</label>
                <input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Mot de passe temporaire</label>
                <input type="text" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Min. 8 caractères" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Rôle</label>
                <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="client">Client</option>
                  <option value="chauffeur">Chauffeur</option>
                  <option value="gerant">Gérant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={handleCreate} disabled={creating} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {creating ? "Création..." : "Créer l'utilisateur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Modifier — {editUser.full_name || editUser.email}</h2>
              <button onClick={() => setEditUser(null)} className="rounded-lg p-1 hover:bg-secondary"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nom complet</label>
                <input value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Rôle</label>
                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="client">Client</option>
                  <option value="chauffeur">Chauffeur</option>
                  <option value="gerant">Gérant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={handleEditSave} disabled={editSaving} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {editSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
