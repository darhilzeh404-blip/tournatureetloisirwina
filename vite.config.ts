import { defineConfig as defineLovableConfig } from '@lovable.dev/vite-tanstack-config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';


/**
 * L'application doit tourner comme une PWA/SPA pure sur Android, iPhone,
 * preview et production. Le runtime SSR TanStack Start provoquait des erreurs
 * "Internal Server Error" en preview quand une route ou un import serveur
 * échouait avant l'hydratation.
 *
 * On garde un opt-in explicite pour diagnostiquer SSR localement uniquement :
 * `BUILD_TARGET=ssr vite build`.
 */
const isSpa = process.env.BUILD_TARGET !== 'ssr';

export default isSpa
  ? defineConfig({
      plugins: [
        tsconfigPaths(),
        tailwindcss(),
        tanstackRouter({
          target: 'react',
          // The preview was intermittently serving stale split route modules
          // ("Failed to fetch dynamically imported module ...?tsr-split=component"),
          // leaving users stuck on the router error screen. Keep route modules
          // bundled with the app so preview/production load reliably.
          autoCodeSplitting: false,
          routesDirectory: 'src/routes',
          generatedRouteTree: 'src/routeTree.gen.ts',
        }),
        react(),
      ],
      resolve: {
        alias: {
          // Stubs SPA pour remplacer le runtime serveur TanStack Start
          '@tanstack/react-start/server': path.resolve(
            __dirname,
            'src/lib/spa-shims/tanstack-start.ts',
          ),
          '@tanstack/react-start': path.resolve(
            __dirname,
            'src/lib/spa-shims/tanstack-start.ts',
          ),
          '@/integrations/supabase/client.server': path.resolve(
            __dirname,
            'src/lib/spa-shims/supabase-server.ts',
          ),
        },
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        target: 'es2020',
        rollupOptions: {
          external: [/^\/src\/routes\/api\//],
        },
      },
      server: { host: '::', port: 8080 },
      preview: { host: '::', port: 8080 },
    })
  : defineLovableConfig({});

