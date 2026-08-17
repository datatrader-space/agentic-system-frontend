import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: env.VITE_APP_BASE_URL || '/',
    plugins: [vue()],
    build: {
      // Bump the warning ceiling: our vendor chunks (Monaco, pdf.js, vue-flow)
      // are legitimately large and split out below, so 500 kB was pure noise.
      chunkSizeWarningLimit: 1500,
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
        '/ws': {
          target: env.VITE_API_TARGET ? env.VITE_API_TARGET.replace(/^http/, 'ws') : 'ws://localhost:8001',
          changeOrigin: true,
          ws: true
        }
      }
    }
  }
})