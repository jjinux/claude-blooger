import 'reflect-metadata'
import { join } from 'node:path'
import { DataSource, type DataSourceOptions } from 'typeorm'
import { loadEnv, type Env } from '../config/env.js'
import { SessionEntity } from '../auth/session.entity.js'
import { PostEntity } from '../posts/post.entity.js'
import { UserEntity } from '../users/user.entity.js'
import { SnakeNamingStrategy } from './naming.strategy.js'

/** Listed explicitly rather than glob-loaded: a typo becomes a compile error. */
export const entities = [UserEntity, PostEntity, SessionEntity]

/**
 * The single source of options, shared by the Nest app and the TypeORM CLI.
 * If these two ever diverged, migrations would be generated against a different
 * schema than the one the app actually talks to.
 */
export function buildDataSourceOptions(env: Env): DataSourceOptions {
  const isTest = env.NODE_ENV === 'test'

  return {
    type: 'mysql',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: isTest ? env.DB_NAME_TEST : env.DB_NAME,

    entities,
    // Matches .ts under ts-node and .js after a build, so one setting covers both.
    migrations: [join(import.meta.dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    namingStrategy: new SnakeNamingStrategy(),

    // The schema only ever changes through a reviewed, committed migration.
    // Neither of these is ever true, in any environment.
    synchronize: false,
    migrationsRun: false,

    logging: isTest ? ['error'] : ['error', 'warn', 'migration', 'schema'],

    // Store and compare everything in UTC; let the UI localize.
    timezone: 'Z',
    charset: 'utf8mb4',

    // TypeORM 1.x's default, pinned so it cannot silently drift back. Turns
    // `where: { id: undefined }` into an error instead of "match every row".
    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
  }
}

/**
 * Entry point for the TypeORM CLI (`-d src/database/data-source.ts`).
 *
 * Exported exactly once: the CLI rejects a data source file that exports more
 * than one DataSource instance, so there is deliberately no default export here.
 */
export const AppDataSource = new DataSource(buildDataSourceOptions(loadEnv()))
