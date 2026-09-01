import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Suppression définitive (hard delete) côté administrateur.
 * Appelle la RPC sécurisée `admin_hard_delete` (whitelist de tables + contrôle
 * du rôle admin en base). Gère la sélection multiple et l'état de suppression.
 */
export function useHardDelete(table: string, onDeleted?: () => void) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const remove = useCallback(
    async (ids: string[] = selectedIds) => {
      if (ids.length === 0) return 0;
      setDeleting(true);
      try {
        const { data, error } = await supabase.rpc("admin_hard_delete", {
          _table: table,
          _ids: ids,
        });
        if (error) throw error;
        const count = Number(data ?? 0);
        toast.success(
          `${count} élément${count > 1 ? "s" : ""} supprimé${count > 1 ? "s" : ""} définitivement`,
        );
        clear();
        setConfirmOpen(false);
        onDeleted?.();
        return count;
      } catch (err: any) {
        toast.error(err?.message || "Suppression impossible");
        return 0;
      } finally {
        setDeleting(false);
      }
    },
    [table, selectedIds, clear, onDeleted],
  );

  return {
    selected,
    selectedIds,
    isSelected: (id: string) => selected.has(id),
    toggle,
    selectAll,
    clear,
    remove,
    deleting,
    confirmOpen,
    setConfirmOpen,
  };
}
