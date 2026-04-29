import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { requestNotificationPermission } from "@/lib/notifications";

const DISMISSED_KEY = "wina-notifications-dismissed";

export function AppNotifications() {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
  }, []);

  const enable = async () => {
    const next = await requestNotificationPermission();
    setPermission(next === "unsupported" ? "unsupported" : next);
    if (next === "granted") {
      localStorage.removeItem(DISMISSED_KEY);
      setDismissed(true);
      toast.success("Notifications activées pour l’application.");
    } else if (next === "denied") {
      toast.error("Notifications refusées dans le navigateur.");
    } else {
      toast.error("Notifications non supportées sur cet appareil.");
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  if (!isAuthenticated || permission !== "default" || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border bg-card p-3 shadow-lg sm:bottom-5" role="region" aria-label="Activation des notifications">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-foreground">Notifications Agence Wina</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Recevez les alertes importantes liées à vos réservations et trajets.</p>
          <button type="button" onClick={enable} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <BellRing className="h-4 w-4" />
            Activer
          </button>
        </div>
        <button type="button" onClick={dismiss} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground" aria-label="Fermer la demande de notifications">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}