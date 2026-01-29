import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',  // Listen on all network interfaces
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // Backend IP
        changeOrigin: true,
        secure: false,
        ws: true
      },
      '/ws': {
        target: 'ws://localhost:8000',  // Backend IP for WebSocket
        changeOrigin: true,
        ws: true
      }
    }
  }
})