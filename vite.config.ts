import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import path from 'path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import dotenv from 'dotenv';
import { attachNexoraApi } from './server/attachApi';

dotenv.config();

/**
 * Serve `/api/*` inside the Vite dev server so a preview that runs `vite`
 * (instead of `tsx server.ts`) does not 404 payment/booking routes.
 */
function nexoraApiPlugin(): Plugin {
  return {
    name: 'nexora-api',
    configureServer(server: ViteDevServer) {
      const api = express();
      api.use(express.json({ limit: '32kb' }));
      attachNexoraApi(api);
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api')) {
          next();
          return;
        }
        api(req as unknown as express.Request, res as unknown as express.Response, next);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), nexoraApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'ui-vendor': ['lucide-react'],
            'd3-vendor': ['d3'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
