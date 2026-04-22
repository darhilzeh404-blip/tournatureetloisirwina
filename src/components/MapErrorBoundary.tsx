import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Capture les erreurs de rendu de la carte (Leaflet, WebGL, réseau tuiles…)
 * pour éviter un écran blanc côté chauffeur.
 */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error) {
    console.error("[MapErrorBoundary]", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive opacity-70" />
              <p className="mt-3 font-semibold">Carte indisponible</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Impossible de charger la carte. Vérifiez votre connexion internet et que votre navigateur n'a pas bloqué les ressources.
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Réessayer
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
