import { resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'
import { REPO_ROOT } from './paths.js'

let dotenvLoaded = false

/** Loads the repo-root .env exactly once, for both the Nest app and the TypeORM CLI. */
function ensureDotenv(): void {
  if (dotenvLoaded) return
  loadDotenv({ path: resolve(REPO_ROOT, '.env'), quiet: true })
  dotenvLoaded = true
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  /** Public origin, used to build the absolute URLs that feeds require. */
  APP_URL: z.url(),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  DB_NAME_TEST: z.string().min(1),

  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Parses and validates the environment. Throws at startup rather than letting a
 * missing variable surface later as a confusing connection or auth failure.
 */
export function loadEnv(source?: NodeJS.ProcessEnv): Env {
  ensureDotenv()
  const parsed = envSchema.safeParse(source ?? process.env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${details}`)
  }

  return parsed.data
}
