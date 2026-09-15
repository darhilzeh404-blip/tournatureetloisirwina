import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { showAppNotification } from "@/lib/notifications";
import { installSoundUnlock, playNotificationSound, soundKindForType } from "@/lib/notification-sound";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  category: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
};

type RawNotif = Omit<Notif, "category" | "image_url"> & {
  payload?: { category?: unknown; image_url?: unknown } | null;
  category?: string | null;
  image_url?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  information: "Information",
  promotion: "Promotion",
  alerte: "Alerte",
  evenement: "Événement",
  mise_a_jour: "Mise à jour",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function normalizeNotification(raw: RawNotif): Notif {
  return {
    ...raw,
    category: raw.category ?? (typeof raw.payload?.category === "string" ? raw.payload.category : null),
    image_url: raw.image_url ?? (typeof raw.payload?.image_url === "string" ? raw.payload.image_url : null),
  };
}

export function NotificationCenter() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const go = useCallback(
    (link: string | null) => {
      if (!link) return;
      setOpen(false);
      navigate({ to: link as Parameters<typeof navigate>[0]["to"] }).catch(() => {
        window.location.assign(link);
      });
    },
    [navigate],
  );

  useEffect(() => {
    installSoundUnlock();
  }, []);

  // Chargement initial
  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      seen.current = new Set();
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("user_notifications")
        .select("id,type,title,message,link,payload,is_read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (cancelled) return;
      if (error) {
        console.error("[NotificationCenter] load", error.message);
        return;
      }
      const list = (((data as unknown as RawNotif[] | null) ?? []).map(normalizeNotification));
      list.forEach((n) => seen.current.add(n.id));
      setItems(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Temps réel : chaque nouvelle notification fait du bruit
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = normalizeNotification(payload.new as unknown as RawNotif);
          if (!n?.id || seen.current.has(n.id)) return;
          seen.current.add(n.id);
          setItems((prev) => [n, ...prev].slice(0, 30));

          const kind = soundKindForType(n.type);
          playNotificationSound(kind);

          const opts = {
            description: n.message ?? undefined,
            duration: 8000,
            action: n.link ? { label: "Voir", onClick: () => go(n.link) } : undefined,
          };
          if (kind === "success") toast.success(n.title, opts);
          else if (kind === "error") toast.error(n.title, opts);
          else toast.info(n.title, opts);

          void showAppNotification(n.title, {
            body: n.message ?? undefined,
            tag: n.id,
            url: n.link ?? undefined,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = normalizeNotification(payload.new as unknown as RawNotif);
          setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, ...n } : i)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, go]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("user_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
  };

  const openItem = async (n: Notif) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      await supabase.from("user_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", n.id);
    }
    go(n.link);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        className="fixed right-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-full border bg-card/95 text-foreground shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[59]" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed right-3 top-16 z-[60] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-extrabold">Notifications</p>
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-40"
                disabled={unread === 0}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Tout lire
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune notification.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openItem(n)}
                    className={`block w-full border-b px-4 py-3 text-left transition hover:bg-muted/50 ${n.is_read ? "" : "bg-primary/5"}`}
                  >
                    {n.image_url && <img src={n.image_url} alt="" className="mb-2 max-h-32 w-full rounded-lg object-cover" />}
                    <div className="mb-1 flex items-center gap-2">
                      {n.category && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{CATEGORY_LABELS[n.category] ?? n.category}</span>}
                      {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Non lue" />}
                    </div>
                    <p className="text-sm font-bold text-foreground">{n.title}</p>
                    {n.message && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.message}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">{fmt(n.created_at)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
