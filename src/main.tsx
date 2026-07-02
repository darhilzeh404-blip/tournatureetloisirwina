import React from 'react';
import './lib/android-webview-auth-fix';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { setupDeepLinks } from "./lib/capacitor-deep-links";
if (typeof window !== "undefined") setupDeepLinks();
import { router } from './routes';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const app = (
  <RouterProvider router={router} />
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}