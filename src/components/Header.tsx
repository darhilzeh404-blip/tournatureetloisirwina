import { Link, useNavigate } from "@tanstack/react-router";
import { Bus, Menu, X, LogOut, User } from "lucide-react";
import { useState } from "react";
import { useAuth, getRoleRedirectPath } from "@/hooks/use-auth";

const navLinks = [
  { to: "/transport-scolaire", label: "Transport Scolaire" },
  { to: "/location-bus", label: "Location de Bus" },
  { to: "/circuits", label: "Circuits Touristiques" },
] as const;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, isLoading, role, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const dashboardPath = getRoleRedirectPath(role);

  return (
    <header className="sticky top-0 z-50 glass-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Bus className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Agence <span className="text-gradient">Wina</span></span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium bg-secondary text-foreground" }}
            >
              {link.label}
            </Link>
          ))}

          {!isLoading && isAuthenticated ? (
            <>
              <Link
                to={dashboardPath}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium bg-secondary text-foreground" }}
              >
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Mon Espace
                </span>
              </Link>
              <button
                onClick={handleSignOut}
                className="ml-2 flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </>
          ) : (
            <Link
              to="/connexion"
              className="ml-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Connexion
            </Link>
          )}
        </nav>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-foreground md:hidden"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t bg-card px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium bg-secondary text-foreground" }}
              >
                {link.label}
              </Link>
            ))}

            {!isLoading && isAuthenticated ? (
              <>
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Mon Espace
                </Link>
                <button
                  onClick={() => { handleSignOut(); setMobileOpen(false); }}
                  className="mt-2 rounded-lg border border-input bg-background px-4 py-2 text-center text-sm font-medium text-foreground"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link
                to="/connexion"
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
              >
                Connexion
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
