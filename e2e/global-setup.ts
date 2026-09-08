import { execFileSync } from 'node:child_process'

/**
 * Prepares `blooger_test` once, before any spec runs.
 *
 * These are the repo's own commands rather than a bespoke setup path, so the
 * suite exercises the same migration and seed a developer runs by hand. Running
 * them with NODE_ENV=test is what points them at `blooger_test`; `blooger_dev`
 * is never touched.
 *
 * The suite seeds once and does not truncate between tests. Anything a spec
 * creates therefore outlives it, which is why registrations use a name unique to
 * the run.
 */
export default function globalSetup(): void {
  const env = { ...process.env, NODE_ENV: 'test' }

  for (const script of ['migration:run', 'seed']) {
    execFileSync('npm', ['run', script], { env, stdio: 'inherit' })
  }
}
