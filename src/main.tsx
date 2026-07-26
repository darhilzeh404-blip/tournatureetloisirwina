import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './styles.css';
import { installRecoveryErrorLogging, logRecovery } from "./lib/recovery-log";
if (typeof window !== "undefined") {
  installRecoveryErrorLogging();
  logRecovery("info", "app.boot", { ua: navigator.userAgent });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = rootElement;

function hideBootSplash() {
  const el = document.getElementById('boot-splash');
  if (!el) return;
  el.classList.add('is-hidden');
  window.setTimeout(() => el.remove(), 400);
}

async function startApp() {
  const { router } = await import('./routes');
  const app = <ErrorBoundary><RouterProvider router={router} /></ErrorBoundary>;

  if (root.hasChildNodes()) {
    hydrateRoot(root, app);
  } else {
    createRoot(root).render(app);
  }

  requestAnimationFrame(() => window.setTimeout(hideBootSplash, 250));
}

// Filet de sécurité : ne jamais laisser le splash bloqué à l'écran.
window.setTimeout(hideBootSplash, 6000);

void startApp();
