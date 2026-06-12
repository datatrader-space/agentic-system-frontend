import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: env.VITE_APP_BASE_URL || '/',
    plugins: [vue()],
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