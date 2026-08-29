import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appToast } from "@/lib/app-toast";

export const Route = createFileRoute("/admin/clients")({
  component: AdminClients,
});

interface ClientRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  role: string | null;
}

const PAGE_SIZE = 25;

function AdminClients() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("profiles")
        .select("id, user_id, full_name, email, phone, status, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (debounced) {
        const term = `%${debounced}%`;
        query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
      }

      const { data, error: err, count } = await query;
      if (err) throw err;

      const profiles = data ?? [];
      const userIds = profiles.map((p) => p.user_id);
      const roleMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);
        (roles ?? []).forEach((r) => {
          if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role as string);
        });
      }

      setRows(
        profiles.map((p) => ({
          ...p,
          role: roleMap.get(p.user_id) ?? null,
        })) as ClientRow[],
      );
      setTotal(count ?? profiles.length);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeTable("profiles", () => void load());
  useRealtimeTable("user_roles", () => void load());

  const handleDelete = useCallback(
    async (ids: string[]) => {
      const targets = rows.filter((r) => ids.includes(r.id));
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/admin/delete-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userIds: targets.map((t) => t.user_id) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Suppression impossible");
        appToast.success(
          "Suppression effectuée",
          `${json.deleted} compte(s) supprimé(s) définitivement${json.failed ? `, ${json.failed} échec(s)` : ""}.`,
        );
        await load();
      } catch (e) {
        appToast.fromError(e);
      }
    },
    [rows, load],
  );

  const columns = useMemo<AdminColumn<ClientRow>[]>(
    () => [
      {
        key: "nom",
        header: "Client",
        render: (c) => (
          <div>
            <p className="font-semibold">{c.full_name || "—"}</p>
            <p className="text-xs text-muted-foreground">{c.email ?? "Sans email"}</p>
          </div>
        ),
      },
      { key: "tel", header: "Téléphone", render: (c) => c.phone ?? "—" },
      {
        key: "role",
        header: "Rôle",
        render: (c) => <Badge variant="secondary">{c.role ?? "client"}</Badge>,
      },
      {
        key: "status",
        header: "Statut",
        render: (c) => (
          <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge>
        ),
      },
      {
        key: "created",
        header: "Inscription",
        render: (c) => new Date(c.created_at).toLocaleDateString("fr-FR"),
      },
    ],
    [],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">{total} compte(s) enregistré(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <AdminDataTable
        rows={rows}
        columns={columns}
        getId={(c) => c.id}
        loading={loading}
        error={error}
        emptyLabel="Aucun client trouvé."
        onRefresh={() => void load()}
        onHardDelete={handleDelete}
        deleteLabel="Supprimer les comptes"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} / {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
