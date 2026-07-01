/**
 * Dynamic import failure recovery.
 *
 * When Vite ships a new build, previously loaded HTML references chunks that
 * no longer exist on the server. The browser throws:
 *   - "Failed to fetch dynamically imported module"
 *   - "Importing a module script failed"
 *   - ChunkLoadError
 *
 * This module:
 *  1. Auto-retries once (with a hard reload) on the FIRST such failure per tab session.
 *  2. If reload didn't fix it, injects a lightweight fallback UI (no React needed)
 *     so the user isn't stuck on a blank/broken preview.
 */

const RELOAD_FLAG = "__wina_chunk_reload__";
const OVERLAY_ID = "__wina_chunk_overlay__";

function isChunkError(reason: unknown): boolean {
  if (!reason) return false;
  const msg =
    (reason as any)?.message ??
    (typeof reason === "string" ? reason : String(reason));
  const name = (reason as any)?.name ?? "";
  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

function showFallbackUI() {
  if (typeof document === "undefined") return;
  if (document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-live", "assertive");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:24px",
    "background:rgba(15,23,42,0.85)",
    "backdrop-filter:blur(8px)",
    "-webkit-backdrop-filter:blur(8px)",
    "font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
    "color:#0f172a",
  ].join(";");

  overlay.innerHTML = `
    <div style="max-width:420px;width:100%;background:#fff;border-radius:20px;padding:28px;box-shadow:0 25px 50px -12px rgba(0,0,0,.35);text-align:center;">
      <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:16px;background:linear-gradient(135deg,#3b6cd6,#22c55e);display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;">↻</div>
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">Nouvelle version disponible</h2>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">
        L'application a été mise à jour. Rechargez la page pour continuer.
      </p>
      <div style="display:flex;gap:10px;">
        <button id="__wina_chunk_reload_btn" style="flex:1;padding:12px 16px;border-radius:12px;border:none;background:#3b6cd6;color:#fff;font-weight:600;font-size:14px;cursor:pointer;">
          Recharger
        </button>
        <button id="__wina_chunk_home_btn" style="flex:1;padding:12px 16px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;font-weight:600;font-size:14px;cursor:pointer;">
          Accueil
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("__wina_chunk_reload_btn")?.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {}
    window.location.reload();
  });
  document.getElementById("__wina_chunk_home_btn")?.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {}
    window.location.href = "/";
  });
}

function handleChunkFailure(reason: unknown) {
  if (!isChunkError(reason)) return false;
  console.warn("[chunk-recovery] Dynamic import failed:", reason);

  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {}

  if (!alreadyReloaded) {
    try {
      sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch {}
    // Small delay so any in-flight logging finishes.
    setTimeout(() => window.location.reload(), 100);
    return true;
  }

  // Reload didn't fix it — show manual recovery UI.
  showFallbackUI();
  return true;
}

export function installDynamicImportRecovery() {
  if (typeof window === "undefined") return;
  if ((window as any).__winaChunkRecoveryInstalled) return;
  (window as any).__winaChunkRecoveryInstalled = true;

  window.addEventListener("error", (event) => {
    handleChunkFailure((event as ErrorEvent).error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    handleChunkFailure((event as PromiseRejectionEvent).reason);
  });

  // Clear the reload flag once the app has been alive for a few seconds
  // (means the new bundle loaded successfully).
  setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {}
  }, 5000);
}
