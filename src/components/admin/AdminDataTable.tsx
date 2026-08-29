import { useMemo, useState, type ReactNode } from "react";
import { Loader2, Trash2, RefreshCw, AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface AdminColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

interface AdminDataTableProps<T> {
  rows: T[];
  columns: AdminColumn<T>[];
  getId: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
  onRefresh?: () => void;
  /** Suppression définitive des lignes sélectionnées. */
  onHardDelete?: (ids: string[]) => Promise<void>;
  deleteLabel?: string;
}

/**
 * Tableau admin partagé : sélection multiple, barre d'actions contextuelle,
 * confirmation et suppression définitive.
 */
export function AdminDataTable<T>({
  rows,
  columns,
  getId,
  loading = false,
  error = null,
  emptyLabel = "Aucune donnée.",
  onRefresh,
  onHardDelete,
  deleteLabel = "Supprimer définitivement",
}: AdminDataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ids = useMemo(() => rows.map(getId), [rows, getId]);
  const selectedIds = useMemo(() => ids.filter((id) => selected.has(id)), [ids, selected]);
  const allSelected = ids.length > 0 && selectedIds.length === ids.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(ids));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!onHardDelete) return;
    setDeleting(true);
    try {
      await onHardDelete(selectedIds);
      setSelected(new Set());
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && onHardDelete && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <span className="text-sm font-medium">
            {selectedIds.length} élément{selectedIds.length > 1 ? "s" : ""} sélectionné
            {selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> {deleteLabel}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {onHardDelete && (
                <th className="w-10 p-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Tout sélectionner"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`p-3 font-semibold ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-10 text-center text-muted-foreground">
                  <Inbox className="mx-auto mb-2 h-6 w-6 opacity-60" />
                  {emptyLabel}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const id = getId(row);
              return (
                <tr key={id} className="border-b last:border-0 hover:bg-muted/30">
                  {onHardDelete && (
                    <td className="p-3 align-middle">
                      <Checkbox
                        checked={selected.has(id)}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label="Sélectionner la ligne"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`p-3 align-middle ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.length} élément{selectedIds.length > 1 ? "s" : ""} seront supprimés
              définitivement de la base de données. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
