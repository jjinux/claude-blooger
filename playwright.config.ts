import { defineConfig, devices } from '@playwright/test'

/**
 * The end-to-end suite runs on its own ports, not the ones `npm run dev` uses,
 * so it can run beside a development server without the two fighting over 3000
 * and 5173 -- or, far worse, without the tests quietly talking to a dev API
 * pointed at `blooger_dev` and rewriting real data.
 */
const API_PORT = 3100
const WEB_PORT = 5273
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './e2e',

  // Migrates and seeds blooger_test. Every spec shares that one database.
  globalSetup: './e2e/global-setup.ts',

  // One worker, in file order: there is a single seeded database and nothing
  // truncates between tests, so parallel specs would race each other's data.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,

  // Deliberately low. Registration is rate-limited to 5 attempts per minute and
  // login to 10, per IP -- and every one of these tests comes from 127.0.0.1, so
  // a generous retry budget would turn one flake into a wall of 429s.
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Chromium only. This is a handful of flows proving the stack fits together,
  // not a browser-compatibility matrix.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      // `nest start` -- compile with tsc, then run -- rather than `npm run dev:api`,
      // which is the same thing with a file watcher nobody here wants.
      //
      // Not `tsx src/main.ts`, tempting as it is: tsx transforms with esbuild,
      // which does not implement emitDecoratorMetadata, so Nest's constructor
      // injection resolves every dependency to undefined and the first guarded
      // request dies with "Cannot read properties of undefined". The seed and the
      // TypeORM CLI do run under tsx because neither depends on Nest's DI.
      //
      // Development mode, not production: main.ts only serves the SPA itself when
      // NODE_ENV is production, and a production session cookie is `secure`, which
      // plain http drops -- so a single-origin production run cannot log anyone in.
      command: 'npx nest start',
      cwd: 'apps/api',
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        // Points the app at blooger_test. dotenv does not overwrite variables
        // that are already set, so this wins over the repo's .env.
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        // Absolute URLs in the feeds should point at where the browser is.
        APP_URL: WEB_URL,
      },
      // Never reuse: the rate limiter counts in process memory, so a server left
      // over from an earlier run would start these tests part-way through its
      // window.
      reuseExistingServer: false,
      stdout: 'pipe',
      // Compiling the API from cold takes a while.
      timeout: 120_000,
    },
    {
      command: 'npm run dev:web',
      url: WEB_URL,
      env: {
        WEB_PORT: String(WEB_PORT),
        API_ORIGIN: `http://localhost:${API_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
