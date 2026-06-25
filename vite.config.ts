import { defineConfig as defineLovableConfig } from '@lovable.dev/vite-tanstack-config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';

/**
 * Build cible :
 *  - défaut (Lovable / Cloudflare)   : `vite build`
 *  - SPA statique (VS Code / natif)  : `BUILD_TARGET=spa vite build`
 *
 * Le mode SPA produit un `dist/` statique consommable par Capacitor
 * (webDir: 'dist') et déployable sur n'importe quel hébergeur statique.
 */
const isSpa = process.env.BUILD_TARGET === 'spa' || process.env.CAPACITOR === 'true';

export default isSpa
  ? defineConfig({
      plugins: [
        tsconfigPaths(),
        tailwindcss(),
        tanstackRouter({
          target: 'react',
          autoCodeSplitting: true,
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

