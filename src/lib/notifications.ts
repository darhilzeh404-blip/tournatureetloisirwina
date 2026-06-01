export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
}

export interface AppNotificationOptions extends NotificationOptions {
  /** If provided, clicking the system notification will focus the app and navigate to this path. */
  url?: string;
}

export async function showAppNotification(title: string, options?: AppNotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const { url, ...rest } = options ?? {};
  const data = { ...(rest.data as Record<string, unknown> | undefined), url };

  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration?.showNotification) {
    await registration.showNotification(title, {
      badge: "/icon-192.png",
      icon: "/icon-192.png",
      ...rest,
      data,
    });
    return true;
  }

  const n = new Notification(title, { icon: "/icon-192.png", ...rest, data });
  n.onclick = () => {
    try {
      window.focus();
      if (url) window.location.assign(url);
    } finally {
      n.close();
    }
  };
  return true;
}
