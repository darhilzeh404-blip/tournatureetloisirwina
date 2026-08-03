import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CarFront, X, BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { VTC_REOPEN_LABEL } from "@/lib/vtc-availability";
import vtcMaintenance from "@/assets/vtc-maintenance.png";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VtcUnavailableDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const subscribe = async () => {
    if (!user) {
      toast.error("Connectez-vous pour être notifié du lancement.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vtc_relaunch_subscribers" as never)
        .upsert(
          {
            user_id: user.id,
            email: user.email ?? null,
            phone: (user.user_metadata as Record<string, string> | undefined)?.phone ?? null,
          } as never,
          { onConflict: "user_id" } as never,
        );
      if (error) throw error;
      setSubscribed(true);
      toast.success("Vous serez notifié dès la réouverture du service VTC.");
    } catch {
      toast.error("Impossible d'enregistrer votre demande. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Service VTC temporairement indisponible"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border bg-card shadow-2xl sm:rounded-3xl"
          >
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative bg-gradient-to-br from-primary/20 via-accent/10 to-transparent px-6 pt-8">
              <motion.img
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                src={vtcMaintenance}
                alt="Service VTC en cours d'amélioration"
                className="mx-auto h-40 w-auto object-contain drop-shadow-xl"
                loading="lazy"
                width={768}
                height={576}
              />
            </div>

            <div className="space-y-4 px-6 pb-6 pt-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CarFront className="h-6 w-6" />
              </div>

              <h2 className="text-xl font-bold">Service temporairement indisponible</h2>

              <p className="text-sm leading-relaxed text-muted-foreground">
                Notre service VTC est actuellement en cours d'amélioration afin de vous offrir une
                meilleure expérience.
                <br />
                <br />
                Il sera de nouveau disponible à partir du{" "}
                <span className="font-semibold text-foreground">{VTC_REOPEN_LABEL}</span>.
                <br />
                <br />
                Merci pour votre compréhension.
              </p>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
                {subscribed ? (
                  <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2.5 text-sm font-semibold text-green-600">
                    <CheckCircle2 className="h-4 w-4" /> Vous serez notifié
                  </div>
                ) : (
                  <Button onClick={subscribe} disabled={saving} className="flex-1 rounded-xl">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <BellRing className="mr-2 h-4 w-4" />
                        Être notifié lors du lancement
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
                  Fermer
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
