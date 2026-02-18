import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: env.VITE_APP_BASE_URL || '/',
    plugins: [vue()],
    server: {
      host: '0.0.0.0',  // Listen on all network interfaces
      port: 5173,
      allowedHosts: ['mazily-nippy-dionna.ngrok-free.dev'],
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true
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