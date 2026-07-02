import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, HomeIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary catching unhandled React errors
 * Prevents blank screens and provides user feedback + recovery options
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    // Log to external service in production
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = "/";
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-16 w-16 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Une erreur est survenue
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Nous avons rencontré un problème inattendu. Veuillez essayer de
              recharger la page.
            </p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-left">
                <summary className="cursor-pointer font-mono text-xs font-semibold text-destructive">
                  Détails (dev)
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Recharger
              </button>
              <Link
                to="/"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
              >
                <HomeIcon className="h-4 w-4" />
                Accueil
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
