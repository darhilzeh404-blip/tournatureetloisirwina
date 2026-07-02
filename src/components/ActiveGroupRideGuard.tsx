import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase = supabaseTyped as any;

const ACTIVE_RIDE_STATUSES = ["searching", "matched", "driver_arriving", "active"];

function withTimeout<T>(promise: PromiseLike<T>, ms = 3500): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Au chargement (et à chaque changement de session), vérifie si l'utilisateur
 * a une course groupée active et le redirige vers la salle d'attente.
 * Skip si on est déjà sur la waiting room, l'écran covoiturage, ou un espace pro.
 */
export function ActiveGroupRideGuard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    const path = location.pathname;
    // Ne pas rediriger depuis ces zones
    if (
      path.startsWith("/deplacement-groupe") ||
      path.startsWith("/admin") ||
      path.startsWith("/chauffeur") ||
      path.startsWith("/gerant") ||
      path.startsWith("/agence") ||
      path.startsWith("/connexion") ||
      path.startsWith("/inscription") ||
      path.startsWith("/paiement") ||
      path.startsWith("/mes-reservations") ||
      path.startsWith("/vtc") ||
      path.startsWith("/wallet") ||
      path.startsWith("/espace-client")
    ) {
      return;
    }

    // Ne vérifie qu'une fois par session utilisateur
    if (checkedFor.current === user.id) return;
    checkedFor.current = user.id;

    (async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("group_ride_passengers")
            .select("ride_id, group_rides!inner(status, archived_at)")
            .eq("user_id", user.id)
            .neq("status", "cancelled")
            .order("joined_at", { ascending: false })
            .limit(5),
        );

        if (error) {
          console.error("[ActiveGroupRideGuard]", error);
          return;
        }

        const active = (data ?? []).find((row: any) => {
          const r = row.group_rides;
          return r && r.archived_at === null && ACTIVE_RIDE_STATUSES.includes(r.status);
        });

        if (active?.ride_id) {
          toast.info("Course groupée en cours — redirection…");
          navigate({
            to: "/deplacement-groupe/waiting/$rideId",
            params: { rideId: active.ride_id },
            replace: true,
          });
        }

      } catch (e) {
        console.error("[ActiveGroupRideGuard] exception", e);
      }
    })();
  }, [isAuthenticated, isLoading, user, location.pathname, navigate]);

  return null;
}
