import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const API_ORIGIN = 'http://localhost:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on a single origin in dev, so session cookies behave
      // exactly as they will in production behind one Nest server.
      '/api': { target: API_ORIGIN, changeOrigin: true },
      '/feed.atom': { target: API_ORIGIN, changeOrigin: true },
      '/feed.rss': { target: API_ORIGIN, changeOrigin: true },
      '/feed.json': { target: API_ORIGIN, changeOrigin: true },
      '/sitemap.xml': { target: API_ORIGIN, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
