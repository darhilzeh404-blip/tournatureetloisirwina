import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts, useLocation, useNavigate } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { InstallPrompt } from "@/components/InstallPrompt";
import { IosInstallBanner } from "@/components/IosInstallBanner";
import { AppNotifications } from "@/components/AppNotifications";
import { SplashScreen } from "@/components/SplashScreen";
import { ActiveGroupRideGuard } from "@/components/ActiveGroupRideGuard";
import { registerServiceWorker } from "@/lib/pwa";

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
      { name: "theme-color", content: "#3b6cd6" },
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
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      // Splash resources — preload for instant first paint
      { rel: "preload", as: "image", href: "/icon-192.png", fetchpriority: "high" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [splashDone, setSplashDone] = useState(false);
  const [splashAuth, setSplashAuth] = useState<{ user: { id: string } | null; role: string | null } | null>(null);

  const isFullScreenRoute = location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/chauffeur") ||
    location.pathname.startsWith("/gerant") ||
    location.pathname.startsWith("/espace-client") ||
    location.pathname.startsWith("/reserver-transport") ||
    location.pathname.startsWith("/activites");

  useEffect(() => {
    registerServiceWorker();
  }, []);

  const handleSplashComplete = useCallback((session: { user: { id: string } | null; role: string | null } | null) => {
    setSplashAuth(session);
    setSplashDone(true);
  }, []);

  // After splash, handle client-side redirect for authenticated users landing on home
  useEffect(() => {
    if (!splashDone || !splashAuth) return;

    // If user is authenticated and on the home page, redirect to their space
    if (location.pathname === "/") {
      const role = splashAuth.role;
      if (role === "client") {
        navigate({ to: "/espace-client", replace: true });
      } else if (role === "admin") {
        navigate({ to: "/admin", replace: true });
      } else if (role === "gerant") {
        navigate({ to: "/gerant", replace: true });
      } else if (role === "chauffeur") {
        navigate({ to: "/chauffeur", replace: true });
      }
    }
  }, [splashDone, splashAuth, location.pathname, navigate]);

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
    <QueryClientProvider client={queryClient}>
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
      <AppNotifications />
      <ActiveGroupRideGuard />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
