import React from 'react';
import './lib/android-webview-auth-fix';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { installRecoveryErrorLogging, logRecovery } from "./lib/recovery-log";
if (typeof window !== "undefined") {
  installRecoveryErrorLogging();
  logRecovery("info", "app.boot", { ua: navigator.userAgent });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = rootElement;

async function startApp() {
  // Keep this dynamic: Android auth stability must run before any route/module
  // imports the backend client. Static imports are evaluated too early.
  const { router } = await import('./routes');
  const app = <ErrorBoundary><RouterProvider router={router} /></ErrorBoundary>;

  if (root.hasChildNodes()) {
    hydrateRoot(root, app);
  } else {
    createRoot(root).render(app);
  }
}

void startApp();