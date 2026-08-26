import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './styles.css';
import { installRecoveryErrorLogging, logRecovery } from "./lib/recovery-log";
import { installDynamicImportRecovery } from "./lib/dynamic-import-recovery";
if (typeof window !== "undefined") {
  installRecoveryErrorLogging();
  installDynamicImportRecovery();
  logRecovery("info", "app.boot", { ua: navigator.userAgent });
  // Allègement des effets graphiques coûteux sur Android (flou, ombres,
  // animations longues) : la navigation entre les pages y reste fluide.
  if (/android/i.test(navigator.userAgent)) {
    document.documentElement.classList.add("is-android");
  }
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
  // Import statique du routeur : l'ancien `import('./routes')` dynamique
  // (+ retry `./routes.tsx?retry=…`) échouait en production dès qu'un chunk
  // était remplacé ou que l'URL source n'existait pas → écran blanc/figé
  // sur desktop. Le routeur fait partie du bundle principal, donc plus
  // aucun chunk à récupérer au démarrage.
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
