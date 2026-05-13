import { useEffect, useState } from "react";
import { X, Megaphone, AlertTriangle, Tag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Announcement = {
  id: string;
  title: string;
  description: string;
  type: "promo" | "event" | "alert";
  starts_at: string;
  ends_at: string;
  details_url: string | null;
};

const TYPE_STYLES: Record<Announcement["type"], { bg: string; icon: typeof Tag; label: string }> = {
  promo: { bg: "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white", icon: Tag, label: "Promo" },
  event: { bg: "bg-gradient-to-r from-blue-600 to-indigo-500 text-white", icon: Megaphone, label: "Événement" },
  alert: { bg: "bg-gradient-to-r from-red-600 to-orange-500 text-white", icon: AlertTriangle, label: "Alerte" },
};

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `${fmt(s)} → ${fmt(e)}`;
}

export function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem("dismissed-announcements") || "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("announcements")
        .select("id,title,description,type,starts_at,ends_at,details_url")
        .eq("is_active", true)
        .lte("starts_at", nowIso)
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: false });
      if (!cancelled && data) setItems(data as Announcement[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      localStorage.setItem("dismissed-announcements", JSON.stringify([...next]));
    } catch {}
  };

  const visible = items.filter((it) => !dismissed.has(it.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-3">
      {visible.map((a) => {
        const style = TYPE_STYLES[a.type] ?? TYPE_STYLES.event;
        const Icon = style.icon;
        return (
          <div
            key={a.id}
            className={`relative overflow-hidden rounded-2xl shadow-md ${style.bg}`}
            role="status"
          >
            <div className="flex items-start gap-3 p-4 pr-10">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    {style.label}
                  </span>
                  <span className="text-[11px] opacity-90">{formatRange(a.starts_at, a.ends_at)}</span>
                </div>
                <h3 className="mt-1 text-sm font-bold leading-tight">{a.title}</h3>
                {a.description && (
                  <p className="mt-1 text-xs leading-snug opacity-95 line-clamp-2">{a.description}</p>
                )}
                {a.details_url && (
                  <a
                    href={a.details_url}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-white"
                  >
                    Voir détails
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                aria-label="Fermer l'annonce"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
