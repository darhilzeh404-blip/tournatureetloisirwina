import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth, getRoleRedirectPath } from "@/hooks/use-auth";
import { User, Mail, Phone, LogIn } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/mon-compte")({
  head: () => ({
    meta: [
      { title: "Mon Compte — Agence Wina" },
      { name: "description", content: "Gérez votre profil et vos préférences." },
    ],
  }),
  component: MonComptePage,
});

function MonComptePage() {
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      navigate({ to: getRoleRedirectPath(role) });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center px-4 py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <LogIn className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Connexion requise</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour accéder à votre espace.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to="/connexion"
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Se connecter
            </Link>
            <Link
              to="/inscription"
              className="rounded-xl border border-input bg-background px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return null;
}
