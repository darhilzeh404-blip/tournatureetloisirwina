import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { triggerArrivalAlert } from "@/lib/vtc-horn";

/** Test local du son, de la vibration et de la notification « chauffeur arrivé ». */
export function AlertTestButton({ label = "Tester l'alerte d'arrivée" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await triggerArrivalAlert(true);
      if (r.notificationShown) toast.success("Son et notification reçus correctement.");
      else if (r.permission === "denied") toast.warning("Son joué. Notifications bloquées : autorisez-les dans les réglages du navigateur.");
      else if (r.permission === "unsupported") toast.warning("Son joué. Ce navigateur ne gère pas les notifications (sur iPhone, ajoutez l'app à l'écran d'accueil).");
      else toast.warning("Son joué. Notification non affichée : ouvrez l'application dans son propre onglet et réessayez.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={run} disabled={busy}>
      <BellRing className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}
