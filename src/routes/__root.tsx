import { Outlet, Link, createRootRouteWithContext, useLocation, useNavigate } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { InstallPrompt } from "@/components/InstallPrompt";
import { IosInstallBanner } from "@/components/IosInstallBanner";
import { ConsentBanner } from "@/components/ConsentBanner";
import { AppNotifications } from "@/components/AppNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SplashScreen } from "@/components/SplashScreen";
import { ActiveGroupRideGuard } from "@/components/ActiveGroupRideGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StuckRouteRecovery } from "@/components/StuckRouteRecovery";
import { AdminPreviewBanner } from "@/components/AdminPreviewBanner";
import { registerServiceWorker } from "@/lib/pwa";
import { installDynamicImportRecovery } from "@/lib/dynamic-import-recovery";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Agence Wina — Transport & Tourisme au Gabon" },
      { name: "description", content: "Réservez votre transport scolaire, location de bus et circuits touristiques au Gabon avec Agence Wina." },
      { name: "theme-color", content: "#064E3B" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Tour Wina" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Agence Wina — Transport & Tourisme au Gabon" },
      { property: "og:description", content: "Réservez votre transport scolaire, location de bus et circuits touristiques au Gabon avec Agence Wina." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Agence Wina — Transport & Tourisme au Gabon" },
      { name: "twitter:description", content: "Réservez votre transport scolaire, location de bus et circuits touristiques au Gabon avec Agence Wina." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/84da3ff9-cab5-4915-8e53-16beddec7ae2/id-preview-cdd3f615--28cb96f8-52e8-40fc-b12a-6d241ba6f2f3.lovable.app-1776438961901.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/84da3ff9-cab5-4915-8e53-16beddec7ae2/id-preview-cdd3f615--28cb96f8-52e8-40fc-b12a-6d241ba6f2f3.lovable.app-1776438961901.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      // Splash resources — preload for instant first paint
      { rel: "preload", as: "image", href: "/icon-192.png", fetchPriority: "high" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [splashDone, setSplashDone] = useState(false);

  const AUTH_ROUTES = ["/", "/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"];

  const isFullScreenRoute = AUTH_ROUTES.includes(location.pathname) ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/chauffeur") ||
    location.pathname.startsWith("/gerant") ||
    
    location.pathname.startsWith("/espace-client") ||
    location.pathname.startsWith("/reserver-transport") ||
    location.pathname.startsWith("/activites") ||
    location.pathname.startsWith("/mes-reservations") ||
    location.pathname.startsWith("/mon-compte") ||
    location.pathname.startsWith("/wallet") ||
    location.pathname.startsWith("/wina-coins") ||
    location.pathname.startsWith("/vtc") ||
    location.pathname.startsWith("/circuits") ||
    location.pathname.startsWith("/billets") ||
    location.pathname.startsWith("/catalogue") ||
    location.pathname.startsWith("/deplacement-groupe") ||
    location.pathname.startsWith("/transport-scolaire") ||
    location.pathname.startsWith("/transport-extra-scolaire") ||
    location.pathname.startsWith("/location-bus") ||
    location.pathname.startsWith("/tarifs") ||
    location.pathname.startsWith("/paiement") ||
    location.pathname.startsWith("/suivi");

  useEffect(() => {
    installDynamicImportRecovery();
    registerServiceWorker();
  }, []);

  const handleSplashComplete = useCallback((session: { user: { id: string } | null; role: string | null } | null) => {
    // Si l'utilisateur est connecté ET sur "/", on redirige AVANT de masquer le splash
    // pour éviter tout flash de l'écran d'accueil non-connecté.
    if (session?.user && location.pathname === "/") {
      const role = session.role;
      let target: string | null = null;
      if (role === "client") target = "/espace-client";
      else if (role === "admin") target = "/admin";
      else if (role === "gerant") target = "/gerant";
      else if (role === "chauffeur") target = "/chauffeur";
      

      if (target) {
        navigate({ to: target as any, replace: true });
        // Laisse le routeur monter la nouvelle route avant de retirer le splash
        setTimeout(() => setSplashDone(true), 150);
        return;
      }
    }
    setSplashDone(true);
  }, [location.pathname, navigate]);

  // Prevent scroll while splash is visible
  useEffect(() => {
    if (!splashDone) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [splashDone]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StuckRouteRecovery />
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        {isFullScreenRoute ? (
          <Outlet />
        ) : (
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
              <Outlet />
            </main>
            <Footer />
          </div>
        )}
        <InstallPrompt />
        <IosInstallBanner />
        <ConsentBanner />
        <AppNotifications />
        <NotificationCenter />
        <ActiveGroupRideGuard />
        <AdminPreviewBanner />
        <Toaster
          position="top-center"
          expand={false}
          visibleToasts={3}
          offset={16}
          mobileOffset={12}
          toastOptions={{
            classNames: {
              toast:
                "w-full sm:max-w-sm rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-xl backdrop-blur-md text-card-foreground",
              title: "text-sm font-semibold leading-snug",
              description: "text-xs leading-relaxed text-muted-foreground",
              actionButton: "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground",
              cancelButton: "rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground",
              closeButton: "text-muted-foreground hover:text-foreground",
              error: "border-red-500/30",
              success: "border-emerald-500/30",
              warning: "border-amber-500/30",
              info: "border-sky-500/30",
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
