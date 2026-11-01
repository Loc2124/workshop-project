import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
  envDir: '../..',
  plugins: [react(), tailwindcss()],
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
        manualChunks(id) {
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
          if (modulePath.includes('/node_modules/@tanstack/')) {
            return 'query-vendor';
          }
          if (/\/node_modules\/(@radix-ui|@floating-ui)\//.test(modulePath)) {
            return 'ui-vendor';
          }
        },
      },
    },
  },
  server: { port: 3000 },
}));
