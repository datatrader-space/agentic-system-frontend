import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { configDefaults } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import iconSubset from './scripts/vite-icon-subset.js'

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Bundle size report (page-speed plan Phase 0 item 6): `ANALYZE=1 npx vite build` writes
  // dist/stats.html. Off by default, so a normal build is unchanged; loaded only when asked for. Never for the
  // prerender's server build (scripts/prerender.mjs), which would overwrite the app's report with its own.
  const analyze = process.env.ANALYZE === '1' && !isSsrBuild
  const analyzePlugins = analyze
    ? [import('rollup-plugin-visualizer').then(({ visualizer }) =>
        visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap' }))]
    : []

  return {
    base: env.VITE_APP_BASE_URL || '/',
    plugins: [vue(), iconSubset({ srcDir: fileURLToPath(new URL('./src', import.meta.url)) }), ...analyzePlugins],
    // training-data/ is its own page with its own tests, run by Node's test runner ("test" in package.json).
    test: { exclude: [...configDefaults.exclude, 'training-data/**', 'tests/e2e/**'] },
    // Production builds drop console.log / console.debug / console.info: they printed whole server error
    // bodies and every WebSocket frame into the browser console of every user (audit finding A14).
    // console.warn and console.error stay, so real failures are still visible.
    esbuild: mode === 'production'
      ? { pure: ['console.log', 'console.debug', 'console.info'] }
      : {},
    build: {
      // Bump the warning ceiling: our vendor chunks (Monaco, pdf.js, vue-flow)
      // are legitimately large and split out below, so 500 kB was pure noise.
      chunkSizeWarningLimit: 1500,
      // dist/.vite/ssr-manifest.json: which built files hold each source module. scripts/prerender.mjs reads it to
      // link a prerendered page's own stylesheets (they live in its lazy route chunk), then deletes it.
      ssrManifest: !isSsrBuild,
      rollupOptions: {
        // Silence one benign, known warning: useChatStore is intentionally
        // dynamically imported in useCanvasStore.publish() to break a static
        // circular dependency (see the comment there). Because useChatStore is
        // also statically imported by many components, Vite notes the dynamic
        // import "will not move module into another chunk" — expected here, so
        // drop just this message and let every other warning through.
        onwarn(warning, warn) {
          if (
            warning.message &&
            warning.message.includes('dynamically imported by') &&
            warning.message.includes('but also statically imported')
          ) return
          warn(warning)
        },
        output: {
          // Split heavy third-party libs into their own cached chunks so the
          // browser downloads them in parallel and reuses them across deploys,
          // instead of shipping one ~8 MB index-*.js on first paint.
          manualChunks(id) {
            // PIN VITE'S PRELOAD HELPER, or it decides the whole graph.
            //
            // `__vitePreload` is a ~30-line runtime that EVERY chunk containing a dynamic import
            // pulls in. Its module id is virtual (`\0vite/preload-helper.js`), so the
            // node_modules test below returns undefined for it and rollup places it wherever it
            // likes -- and it chose `monaco`. The consequence was invisible and expensive: all 102
            // route chunks then STATICALLY imported the 4 MB editor to reach that helper, which put
            // monaco in the entry's static graph, which put a `<link rel="modulepreload">` for it in
            // index.html. Every route paid for the code editor, chat included, and making
            // CodeBrowser's own import dynamic did not move it because this was never the reason.
            // Pinning it to a chunk that always loads keeps it out of everyone's import graph.
            if (id.includes('vite/preload-helper')) return 'vue-core'
            if (!id.includes('node_modules')) return
            // Monaco (code editor) is by far the biggest — isolate it.
            if (id.includes('monaco-editor')) return 'monaco'
            if (id.includes('pdfjs-dist')) return 'pdf'
            if (id.includes('@vue-flow')) return 'vue-flow'
            // highlight.js and marked are SEPARATE chunks on purpose. Bundled together, the chat route
            // (which needs only `marked`, ~50 kB) pulled the whole ~900 kB highlight.js with it. hljs is
            // now only imported by FileViewer / UnifiedAgentChat / RepositoryChat — all lazily loaded —
            // so the chat route stops paying for a syntax highlighter it never runs.
            if (id.includes('highlight.js')) return 'highlight'
            if (id.includes('marked')) return 'markdown'
            if (id.includes('@iconify') || id.includes('lucide-vue-next')) return 'icons'
            // Own chunks for libraries only some pages use, so `vendor` (preloaded on EVERY page) does not
            // carry them: charts (dashboards), the QR encoder (2FA setup) and web-vitals (loaded after mount).
            if (id.includes('chart.js') || id.includes('vue-chartjs')) return 'charts'
            if (id.includes('/uqr/')) return 'qr'
            if (id.includes('web-vitals')) return 'rum'
            // KaTeX is imported lazily (utils/mathRenderer.js) for chat answers that contain math. Without its own
            // chunk the catch-all below put it, and its fonts' CSS, in `vendor`, which EVERY page preloads.
            if (id.includes('/katex/')) return 'katex'
            if (
              id.includes('/vue/') ||
              id.includes('/@vue/') ||
              id.includes('vue-router') ||
              id.includes('pinia') ||
              id.includes('vue-toastification')
            ) return 'vue-core'
            return 'vendor'
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // Dev-server prebundling. Without this, esbuild discovers deps lazily: the first route that pulls
    // `lucide-vue-next` (48 files import named icons from the barrel) triggers a mid-session
    // re-optimization, which forces a FULL page reload — the "clicked something, everything reloaded
    // and took seconds" behaviour in local dev. Listing them up front pays that cost once at startup.
    // Deliberately NOT listed: monaco-editor, pdfjs-dist and @vue-flow — they're route-level/dynamic
    // imports, so prebundling them would slow cold dev start for routes most sessions never open.
    optimizeDeps: {
      include: [
        'lucide-vue-next',
        '@iconify/vue',
        'marked',
        'marked-highlight',
        'highlight.js',
        'axios',
        'pinia',
        'vue-router',
        'vue-toastification',
      ],
    },
    server: {
      host: '0.0.0.0',  // Listen on all network interfaces
      port: 5173,
      allowedHosts: true,
      // Dev proxies straight to DJANGO (the web container's own port), not to the backend's nginx on
      // :8000. One hop instead of two. The nginx hop added nothing in dev — Vite already terminates the
      // browser connection — and it actively broke absolute-URL generation: nginx forwards `Host $host`,
      // which drops the port, so Django saw `192.168.18.10` for a request that arrived on
      // `192.168.18.10:5173` and published its OAuth `issuer` without the port. Talking to Django
      // directly means the Host the browser sent is the Host Django sees, and no proxy config has to be
      // kept in sync for absolute URLs to be correct.
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8001',
          // `changeOrigin: false` ON PURPOSE. With it true, the proxy rewrites the Host header to the
          // TARGET (localhost:8000), so every absolute URL Django builds from the request came back
          // pointing at the backend origin — an origin the MCP surface is deliberately not exposed on.
          // The MCP endpoint is published at the FRONTEND origin (aadml.com/api/mcp/v1, and
          // localhost:5173/api/mcp/v1 in dev), and an OAuth client validates that the discovery
          // document's `issuer` matches where it fetched it from. A challenge that said
          // `http://localhost:8000/.well-known/...` sent the client to an origin that is not the one it
          // is talking to — and in production is not reachable at all. Keeping the real Host makes
          // Django generate `http://localhost:5173/...`, which is the truth.
          changeOrigin: false,
          secure: false,
          ws: true
        },
        // OAuth discovery lives at the ORIGIN ROOT, not under /api — RFC 9728 and RFC 8414 both define
        // these paths relative to the origin, and a client that cannot find them there concludes the
        // host is not an OAuth-capable server. Without this entry they fell through to the SPA
        // catch-all and returned `200 text/html`, which is worse than a 404: the client received a
        // successful response that was not a discovery document and reported the server as not
        // publishing one.
        '/.well-known/oauth-': {
          target: env.VITE_API_TARGET || 'http://localhost:8001',
          changeOrigin: false,
          secure: false
        },
        // Serve backend-generated media (generated images/videos) through the dev server so relative
        // /media/... URLs resolve to the backend, not the Vite origin (which 404s).
        '/media': {
          target: env.VITE_API_TARGET || 'http://localhost:8001',
          changeOrigin: true,
          secure: false
        },
        // Training Data is a Django-rendered app (training_models_data); in prod nginx proxies it the same way.
        // changeOrigin false so its CSRF-protected forms see the Host the browser sent.
        '/training-data': {
          target: env.VITE_API_TARGET || 'http://localhost:8001',
          changeOrigin: false,
          secure: false
        },
        // The new Training Data page has its own Vite server (training-data/vite.config.mjs, 127.0.0.1:5174, base
        // /dashboard/training-data/). Reaching it through THIS origin is what lets it share the AADML session cookie
        // and the selected workspace, as it does in production, where nginx serves its built files at this path.
        // ws: its hot-reload socket lives under the same path.
        '/dashboard/training-data': {
          target: 'http://127.0.0.1:5174',
          changeOrigin: false,
          ws: true
        },
        // Its stylesheet and scripts are Django static files (in prod nginx serves /static). Without this
        // entry they fell through to the SPA shell (`200 text/html`) and the Training pages came out unstyled.
        '/static': {
          target: env.VITE_API_TARGET || 'http://localhost:8001',
          changeOrigin: false,
          secure: false
        },
        '/ws': {
          target: env.VITE_API_TARGET ? env.VITE_API_TARGET.replace(/^http/, 'ws') : 'ws://localhost:8001',
          changeOrigin: true,
          ws: true
        }
      }
    }
  }
})