import { createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, HomeIcon } from 'lucide-react';
import { routeTree } from './routeTree.gen';
import type { ErrorComponentProps } from '@tanstack/react-router';

const queryClient = new QueryClient();

function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Impossible de charger cette page</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Une erreur a interrompu l'affichage. Rechargez la page ou revenez à l'accueil.
        </p>
        {import.meta.env.DEV && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left font-mono text-xs text-destructive">
            {message}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
          >
            <HomeIcon className="h-4 w-4" />
            Accueil
          </button>
        </div>
      </section>
    </main>
  );
}

function RoutePendingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-sm font-medium text-muted-foreground">Chargement…</p>
      </div>
    </main>
  );
}

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultErrorComponent: RouteErrorFallback,
  defaultPendingComponent: RoutePendingFallback,
  defaultPendingMs: 300,
});