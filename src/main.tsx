import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import './lib/android-webview-auth-fix';
import { router } from './routes';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const app = (
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}