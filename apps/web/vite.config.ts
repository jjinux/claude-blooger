import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Overridden by the end-to-end suite, which runs the pair on its own ports so it
// can coexist with `npm run dev` instead of colliding with it.
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3000'
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: WEB_PORT,
    // Fail loudly rather than sliding to the next free port, which would leave
    // Playwright waiting on a URL nothing is listening to.
    strictPort: true,
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
