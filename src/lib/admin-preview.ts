// Simple client-side flag letting admins browse the app as a client
// while remaining fully authenticated. No impersonation of another user —
// this is purely a UI preview toggle stored in sessionStorage.

const KEY = "admin_client_preview";

export function isClientPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setClientPreview(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event("admin-preview-changed"));
  } catch {
    /* ignore */
  }
}

export function subscribeClientPreview(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("admin-preview-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("admin-preview-changed", cb);
    window.removeEventListener("storage", cb);
  };
}
