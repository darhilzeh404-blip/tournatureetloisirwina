/**
 * Son de notification "in-app".
 * Utilise la Web Audio API (aucun fichier audio à charger) + vibration mobile.
 * Le contexte audio est débloqué au premier geste utilisateur (contrainte iOS/Android).
 */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** À appeler une fois au démarrage : débloque l'audio au premier tap/clic. */
export function installSoundUnlock() {
  if (typeof window === "undefined" || unlocked) return;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    unlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

type Tone = { freq: number; at: number; dur: number; gain?: number };

function playTones(tones: Tone[]) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime + 0.01;
  for (const t of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(t.freq, now + t.at);
    const peak = t.gain ?? 0.28;
    gain.gain.setValueAtTime(0.0001, now + t.at);
    gain.gain.exponentialRampToValueAtTime(peak, now + t.at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.at + t.dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now + t.at);
    osc.stop(now + t.at + t.dur + 0.05);
  }
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export type SoundKind = "info" | "success" | "error";

/** Joue un carillon audible pour toute notification. */
export function playNotificationSound(kind: SoundKind = "info") {
  try {
    if (kind === "success") {
      playTones([
        { freq: 880, at: 0, dur: 0.16 },
        { freq: 1174.66, at: 0.14, dur: 0.2 },
        { freq: 1567.98, at: 0.3, dur: 0.28 },
      ]);
      vibrate([40, 60, 40]);
      return;
    }
    if (kind === "error") {
      playTones([
        { freq: 440, at: 0, dur: 0.2, gain: 0.32 },
        { freq: 311.13, at: 0.2, dur: 0.34, gain: 0.32 },
      ]);
      vibrate([120, 80, 120]);
      return;
    }
    playTones([
      { freq: 987.77, at: 0, dur: 0.18 },
      { freq: 1318.51, at: 0.16, dur: 0.26 },
    ]);
    vibrate([60, 50, 60]);
  } catch (err) {
    console.error("[notification-sound]", err);
  }
}

/** Déduit la tonalité à jouer depuis le type de notification serveur. */
export function soundKindForType(type: string): SoundKind {
  const t = (type || "").toLowerCase();
  if (t.includes("refus") || t.includes("cancel") || t.includes("annul") || t.includes("expired") || t.includes("fail") || t.includes("echec") || t.includes("rejected")) {
    return "error";
  }
  if (t.includes("paid") || t.includes("payment_success") || t.includes("ticket_issued") || t.includes("confirm") || t.includes("accepted") || t.includes("completed") || t.includes("offer_sent")) {
    return "success";
  }
  return "info";
}
