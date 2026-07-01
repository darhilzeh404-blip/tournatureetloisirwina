import { useEffect } from 'react';
import { createRouter, useRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

// Vérification Capacitor (mobile seulement)
const isNative = typeof window !== 'undefined' && 'Capacitor' in window;

// Fonction push notifications
async function initPushNotifications() {
  console.log('🔥 initPushNotifications called!');
  console.log('🔍 isNative:', isNative);
  
  if (!isNative) {
    console.log('⚠️ Browser mode - push notifications inactive');
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      await PushNotifications.register();
      console.log('✅ Push notifications registered!');
    } else {
      console.log('❌ Permission denied');
    }

    PushNotifications.addListener('registration', (token) => {
      console.log('🔑 FCM Token:', token.value);
      sendTokenToServer(token.value);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📬 Notification:', notification.title, notification.body);
      showNotification(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Tapped:', action.notification.data);
      handleNotificationTap(action.notification);
    });
  } catch (error) {
    console.error('❌ Push error:', error);
  }
}

async function sendTokenToServer(token: string) {
  console.log('📤 Sending token to server:', token);
}

function showNotification(notification: any) {
  console.log('🖼️ Showing notification:', notification.title, notification.body);
}

function handleNotificationTap(notification: any) {
  console.log('🎯 Navigation:', notification.data);
}

function DefaultErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Une erreur est survenue
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quelque chose s'est mal passé. Veuillez réessayer.
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

function DefaultPendingComponent() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm">Chargement…</p>
      </div>
    </div>
  );
}

// Init push notifications only on native platform, and only in browser context
if (isNative) {
  initPushNotifications();
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: DefaultPendingComponent,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};