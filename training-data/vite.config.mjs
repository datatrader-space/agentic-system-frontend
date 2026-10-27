import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// The Training Data page is served by AADML at /dashboard/training-data/ (nginx in production; in development the
// AADML dev server on :5173 proxies that path here). Open it through http://localhost:5173/dashboard/training-data/
// so it shares the AADML sign-in cookie and selected workspace.
const backend = process.env.VITE_API_TARGET || 'http://localhost:8001';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/dashboard/training-data/',
  plugins: [vue()],
  cacheDir: '.vite',
  publicDir: false,
  css: { postcss: { plugins: [] } },
  server: {
    host: '127.0.0.1', port: 5174, strictPort: true,
    // Requests arrive through the AADML dev server with its Host (localhost:5173 or a LAN address).
    allowedHosts: true,
    // Only used when this server is opened directly; through :5173 the AADML proxy answers /api.
    // changeOrigin false: Django checks CSRF against the Host the browser sent.
    // /media and /media-dl: the Library's files, served by Django with the same session cookie (nginx in production).
    // /ws: the Agent page's chat (AADML's chat socket), so the page also works when this server is opened directly.
    proxy: { '/api': { target: backend, changeOrigin: false }, '/media': { target: backend, changeOrigin: false }, '/media-dl': { target: backend, changeOrigin: false },
             '/ws': { target: backend.replace(/^http/, 'ws'), ws: true, changeOrigin: false } },
  },
  // Built into the AADML output, after the AADML build (`npm run build`), at the path nginx serves.
  build: { outDir: fileURLToPath(new URL('../dist/dashboard/training-data', import.meta.url)), emptyOutDir: true },
});
