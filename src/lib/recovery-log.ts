/**
 * Lightweight logger for route-recovery diagnostics.
 * Writes to console AND a capped ring buffer in localStorage so we can
 * inspect Android freezes after the fact (via /admin or devtools).
 */

const STORAGE_KEY = "wina_recovery_log";
const MAX_ENTRIES = 100;

export type RecoveryLogLevel = "info" | "warn" | "error" | "success";

export interface RecoveryLogEntry {
  ts: number;
  iso: string;
  level: RecoveryLogLevel;
  event: string;
  href?: string;
  userAgent?: string;
  data?: Record<string, unknown>;
}

function safeRead(): RecoveryLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecoveryLogEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: RecoveryLogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Quota exceeded — drop half and retry once.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-Math.floor(MAX_ENTRIES / 2))));
    } catch {}
  }
}

export function logRecovery(level: RecoveryLogLevel, event: string, data?: Record<string, unknown>) {
  const entry: RecoveryLogEntry = {
    ts: Date.now(),
    iso: new Date().toISOString(),
    level,
    event,
    href: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    data,
  };

  const prefix = "[recovery]";
  const payload = { event, ...data };
  if (level === "error") console.error(prefix, payload);
  else if (level === "warn") console.warn(prefix, payload);
  else console.log(prefix, payload);

  const entries = safeRead();
  entries.push(entry);
  safeWrite(entries);
}

export function getRecoveryLog(): RecoveryLogEntry[] {
  return safeRead();
}

export function clearRecoveryLog() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** Install global error listeners that log to the same buffer. */
export function installRecoveryErrorLogging() {
  if (typeof window === "undefined") return;
  if ((window as any).__winaRecoveryLoggingInstalled) return;
  (window as any).__winaRecoveryLoggingInstalled = true;

  window.addEventListener("error", (event) => {
    logRecovery("error", "window.error", {
      message: (event as ErrorEvent).message,
      filename: (event as ErrorEvent).filename,
      lineno: (event as ErrorEvent).lineno,
      colno: (event as ErrorEvent).colno,
      stack: ((event as ErrorEvent).error as Error | undefined)?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    logRecovery("error", "unhandledrejection", {
      message: (reason as any)?.message ?? String(reason),
      stack: (reason as any)?.stack,
    });
  });

  // Expose a tiny helper for manual inspection in devtools/Chrome remote debug.
  (window as any).__winaRecoveryLog = () => getRecoveryLog();
}
