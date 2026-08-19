import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { CarFront, Lock } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { isVtcAvailable, VTC_REOPEN_LABEL } from "@/lib/vtc-availability";

export const Route = createFileRoute("/vtc")({
  head: () => ({
    meta: [
      { title: "VTC & Mariage — Agence Wina" },
      { name: "description", content: "Réservez un VTC Standard, Confort, VIP ou un véhicule de mariage à Libreville, Akanda et Owendo. Tarifs fixes par zone." },
    ],
  }),
  component: VtcLayout,
});

/**
 * Indisponibilité VTC : décidée UNIQUEMENT par la date (`isVtcAvailable`),
 * jamais par la plateforme. Le même écran s'affiche sur Android, iOS et Desktop.
 * Le suivi d'une course déjà payée reste accessible.
 */
function VtcLayout() {
  const location = useLocation();
  const isTracking = location.pathname.startsWith("/vtc/suivi");

  if (isVtcAvailable() || isTracking) return <Outlet />;

  return (
    <div className="min-h-screen bg-background">
      <ClientNav />
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-14 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
          <CarFront className="h-11 w-11 text-primary" />
          <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-foreground text-background">
            <Lock className="h-4 w-4" />
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-foreground">VTC</h1>
        <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Indisponible pour le moment
        </p>

        <p className="mt-5 text-sm text-muted-foreground">
          Le service VTC est temporairement suspendu pour maintenance et
          amélioration. Réouverture prévue le{" "}
          <span className="font-semibold text-foreground">{VTC_REOPEN_LABEL}</span>.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3">
          <Link
            to="/espace-client"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Voir les autres services
          </Link>
          <Link
            to="/mes-reservations"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border bg-card px-5 text-sm font-semibold text-foreground"
          >
            Mes réservations
          </Link>
        </div>
      </div>
    </div>
  );
}
