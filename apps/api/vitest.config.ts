import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vite 8 resolves tsconfig `paths` natively, so the vite-tsconfig-paths plugin
  // that Nest's own template still uses is no longer needed. Decorator metadata
  // is handled by Vite's Oxc transform, which is why there is no SWC plugin here.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // Migrates blooger_test once for the whole run.
    globalSetup: ['./test/global-setup.ts'],
    // Database tests share one connection and one rolled-back transaction against
    // a single test schema, so test files must not run in parallel.
    fileParallelism: false,
  },
})
