import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Coins, TrendingUp, Users, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { VipBadge } from "@/components/wina-coins/VipBadge";
import { formatCoins, fetchLevels, type VipLevel } from "@/lib/wina-coins";
import { AdminLevelsManager } from "@/components/wina-coins/AdminLevelsManager";

export const Route = createFileRoute("/admin/fidelite")({
  component: AdminFidelitePage,
});

interface UserRow {
  user_id: string;
  coins_balance: number;
  total_coins_earned: number;
  total_reservations: number;
  vip_level_id: string | null;
  full_name?: string;
  email?: string;
}

function AdminFidelitePage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [levels, setLevels] = useState<VipLevel[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<UserRow | null>(null);
  const [delta, setDelta] = useState<number>(0);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: bal }, lv] = await Promise.all([
      supabase.from("wina_coin_balances").select("*").order("total_coins_earned", { ascending: false }).limit(200),
      fetchLevels(),
    ]);
    setLevels(lv);
    const rows = (bal || []) as UserRow[];
    const ids = rows.map((r) => r.user_id);
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      const map = new Map((profiles || []).map((p) => [p.user_id, p]));
      rows.forEach((r) => {
        const p = map.get(r.user_id);
        if (p) {
          r.full_name = p.full_name;
          r.email = p.email ?? undefined;
        }
      });
    }
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const totalCoins = users.reduce((s, u) => s + u.coins_balance, 0);
  const totalEarned = users.reduce((s, u) => s + u.total_coins_earned, 0);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      u.user_id.toLowerCase().includes(q)
    );
  });

  const levelName = (id: string | null) => levels.find((l) => l.id === id)?.level_name ?? "Silver";

  const adjust = async () => {
    if (!target) return;
    if (!note.trim()) return toast.error("Note obligatoire");
    if (!delta) return toast.error("Montant invalide");
    const { error } = await supabase.rpc("admin_adjust_coins", {
      _user_id: target.user_id,
      _delta: delta,
      _note: note.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success(`${delta > 0 ? "+" : ""}${delta} coins appliqués`);
    setTarget(null);
    setDelta(0);
    setNote("");
    await load();
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Fidélité Wina Coins</h1>
        <p className="text-sm text-muted-foreground">Suivi des soldes, ajustements manuels et statistiques.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Coins className="h-3.5 w-3.5" /> En circulation
            </div>
            <p className="mt-1 text-2xl font-bold">{formatCoins(totalCoins)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Total cumulé
            </div>
            <p className="mt-1 text-2xl font-bold">{formatCoins(totalEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Membres actifs
            </div>
            <p className="mt-1 text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
      </div>

      <AdminLevelsManager />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-3">Client</th>
                    <th className="p-3">Niveau</th>
                    <th className="p-3 text-right">Solde</th>
                    <th className="p-3 text-right">Cumulé</th>
                    <th className="p-3 text-right">Réservations</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.user_id} className="border-b last:border-0">
                      <td className="p-3">
                        <p className="font-medium">{u.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <VipBadge level={levelName(u.vip_level_id)} size="sm" />
                          <span className="text-xs font-semibold">{levelName(u.vip_level_id)}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold">{formatCoins(u.coins_balance)}</td>
                      <td className="p-3 text-right">{formatCoins(u.total_coins_earned)}</td>
                      <td className="p-3 text-right">{u.total_reservations}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setTarget(u)}>
                          Ajuster
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-lg font-bold">Ajuster les coins</h3>
              <p className="text-xs text-muted-foreground">
                Client : <strong>{target.full_name || target.email || target.user_id.slice(0, 8)}</strong>
                <br />
                Solde actuel : <strong>{formatCoins(target.coins_balance)}</strong>
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setDelta((d) => d - 50)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(Number(e.target.value) || 0)}
                  className="text-center font-bold"
                />
                <Button variant="outline" size="icon" onClick={() => setDelta((d) => d + 50)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Note (raison de l'ajustement) — obligatoire"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setTarget(null); setDelta(0); setNote(""); }}>
                  Annuler
                </Button>
                <Button onClick={adjust}>Appliquer</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
