import { supabase } from "@/integrations/supabase/client";

const channelName = (reservationId: string) => `vtc-horn-${reservationId}`;

/** Son de klaxon synthétisé (double coup). */
export function playHorn() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.45].forEach((at) => {
      [392, 494].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.03);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + at + 0.32);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.38);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.4);
      });
    });
    navigator.vibrate?.([300, 150, 300]);
    setTimeout(() => ctx.close(), 1500);
  } catch { /* audio indisponible */ }
}

/**
 * Le chauffeur klaxonne. La vérification est faite côté serveur :
 * seul le chauffeur assigné à la course peut créer l'événement.
 */
export async function sendHorn(reservationId: string) {
  const { error } = await (supabase as any).rpc("send_vtc_horn", { _reservation_id: reservationId });
  if (error) throw new Error(error.message);
}

/** Alerte complète « chauffeur arrivé » : son, vibration et notification système. */
export async function triggerArrivalAlert(test = false) {
  playHorn();
  const { requestNotificationPermission, showAppNotification } = await import("@/lib/notifications");
  const perm = await requestNotificationPermission();
  const shown = perm === "granted"
    ? await showAppNotification(test ? "Test — Votre chauffeur est arrivé" : "Votre chauffeur est arrivé !", {
        body: "Il vous attend au point de départ.",
      })
    : false;
  return { permission: perm, notificationShown: shown };
}

/** Côté client : écoute uniquement les klaxons validés par le serveur. */
export function listenHorn(reservationId: string, onHorn: () => void) {
  const ch = supabase
    .channel(channelName(reservationId))
    .on(
      "postgres_changes" as any,
      { event: "INSERT", schema: "public", table: "vtc_horn_events", filter: `reservation_id=eq.${reservationId}` },
      () => onHorn(),
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
