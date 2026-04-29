export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
}

export async function showAppNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration?.showNotification) {
    await registration.showNotification(title, {
      badge: "/icon-192.png",
      icon: "/icon-192.png",
      ...options,
    });
    return true;
  }

  new Notification(title, { icon: "/icon-192.png", ...options });
  return true;
}