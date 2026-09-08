import { DataSource } from 'typeorm'
import { loadEnv } from '../src/config/env.js'
import { buildDataSourceOptions } from '../src/database/data-source.js'

/**
 * Migrates blooger_test once for the whole run, rather than once per file.
 * Vitest calls this before any test file is loaded.
 */
export async function setup(): Promise<void> {
  const dataSource = new DataSource(
    buildDataSourceOptions(loadEnv({ ...process.env, NODE_ENV: 'test' })),
  )

  await dataSource.initialize()
  try {
    await dataSource.runMigrations()
  } finally {
    await dataSource.destroy()
  }
}
