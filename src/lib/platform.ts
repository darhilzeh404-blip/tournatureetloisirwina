type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  platform?: string;
};

function getCapacitorBridge(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { Capacitor?: CapacitorBridge }).Capacitor ?? null);
}

export function getCapacitorPlatform(): string | null {
  const capacitor = getCapacitorBridge();
  if (!capacitor) return null;

  try {
    if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform();
  } catch {}

  return typeof capacitor.platform === "string" ? capacitor.platform : null;
}

export function isCapacitorNative(): boolean {
  const capacitor = getCapacitorBridge();
  if (!capacitor) return false;

  try {
    if (typeof capacitor.isNativePlatform === "function") return capacitor.isNativePlatform();
  } catch {}

  const platform = getCapacitorPlatform();
  return platform === "android" || platform === "ios";
}

export function isAndroidWebViewRuntime(): boolean {
  if (typeof navigator === "undefined") return false;

  if (isCapacitorNative() && getCapacitorPlatform() === "android") return true;

  const ua = navigator.userAgent || "";
  return /Android/i.test(ua) && (/\bwv\b/i.test(ua) || /Version\/\d+(?:\.\d+)?\s+Chrome\//i.test(ua));
}
