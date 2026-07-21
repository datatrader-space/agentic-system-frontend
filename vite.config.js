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
            if (id.includes('highlight.js') || id.includes('marked')) return 'markdown'
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
    server: {
      host: '0.0.0.0',  // Listen on all network interfaces
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true
        },
        // Serve backend-generated media (generated images/videos) through the dev server so relative
        // /media/... URLs resolve to the backend, not the Vite origin (which 404s).
        '/media': {
          target: env.VITE_API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        },
        '/ws': {
          target: env.VITE_API_TARGET ? env.VITE_API_TARGET.replace(/^http/, 'ws') : 'ws://localhost:8000',
          changeOrigin: true,
          ws: true
        }
      }
    }
  }
})