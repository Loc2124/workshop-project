import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { bundleMetrics } from './build/bundle-metrics';
import { storagePreconnect } from './build/storage-preconnect';

export default defineConfig(async ({ command, mode }) => ({
  envDir: '../..',
  plugins: [
    react(),
    tailwindcss(),
    bundleMetrics(),
    storagePreconnect(loadEnv(mode, '../..', 'SUPABASE_URL').SUPABASE_URL),
    ...(process.env.ANALYZE === 'true'
      ? [
          (await import('rollup-plugin-visualizer')).visualizer({
            filename: 'dist/bundle-analysis.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  // The shared API .env uses NODE_ENV=development. Build JSX for the same
  // production runtime selected below, regardless of that API setting.
  esbuild: command === 'build' ? { jsxDev: false } : undefined,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define:
    command === 'build'
      ? {
          'process.env.NODE_ENV': JSON.stringify('production'),
          'import.meta.env.DEV': false,
          'import.meta.env.PROD': true,
        }
      : undefined,
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id: string) {
          const modulePath = id.replaceAll('\\', '/');
          if (!modulePath.includes('/node_modules/')) return;
          if (
            /\/node_modules\/(react|react-dom|scheduler)\//.test(modulePath)
          ) {
            return 'react-vendor';
          }
          if (
            /\/node_modules\/(react-router|react-router-dom)\//.test(modulePath)
          ) {
            return 'router-vendor';
          }
          if (
            /\/node_modules\/@tanstack\/(react-query|query-core)\//.test(
              modulePath,
            )
          ) {
            return 'query-vendor';
          }
          if (
            /\/node_modules\/@tanstack\/(react-table|table-core)\//.test(
              modulePath,
            )
          )
            return 'admin-table';
          if (modulePath.includes('/node_modules/@dnd-kit/'))
            return 'admin-dnd';
          if (
            /\/node_modules\/(recharts|recharts-scale|d3-[^/]+|es-toolkit|victory-vendor|@reduxjs\/toolkit|react-redux|redux|redux-thunk|reselect|immer|decimal.js-light|eventemitter3)\//.test(
              modulePath,
            )
          )
            return 'admin-charts';
          // Let Rollup split UI primitives by actual usage. A single Radix
          // vendor chunk pulled admin dropdowns/popovers into every public page.
        },
      },
    },
  },
  server: { port: 3000, strictPort: true },
}));
