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

/** Le chauffeur klaxonne : envoie le signal au client de cette réservation. */
export async function sendHorn(reservationId: string) {
  const ch = supabase.channel(channelName(reservationId));
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 4000);
    ch.subscribe((status) => { if (status === "SUBSCRIBED") { clearTimeout(t); resolve(); } });
  });
  await ch.send({ type: "broadcast", event: "horn", payload: { at: Date.now() } });
  supabase.removeChannel(ch);
}

/** Côté client : écoute le klaxon du chauffeur. */
export function listenHorn(reservationId: string, onHorn: () => void) {
  const ch = supabase
    .channel(channelName(reservationId))
    .on("broadcast", { event: "horn" }, () => onHorn())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
