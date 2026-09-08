import { CSRF_HEADER, type PublicUser, type SessionResponse } from '@blooger/shared'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/bootstrap.js'
import { RateLimitGuard } from '../src/common/rate-limit.guard.js'
import { loadEnv } from '../src/config/env.js'
import { UserEntity } from '../src/users/user.entity.js'

export interface TestApp {
  app: INestApplication
  dataSource: DataSource
  /** Cookie-preserving client, so a login persists across requests in a test. */
  agent: TestAgent
  close: () => Promise<void>
  resetRateLimits: () => void
  /** A second, independent cookie jar -- for tests that need two logged-in users. */
  newAgent: () => TestAgent
}

/**
 * Boots the real application against blooger_test, configured through the same
 * `configureApp` that main.ts uses -- so these tests exercise the app that ships,
 * session middleware and global guards included, not a stripped-down stand-in.
 */
export async function createTestApp(): Promise<TestApp> {
  const env = loadEnv({ ...process.env, NODE_ENV: 'test' })

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication()

  configureApp(app, env)
  await app.init()

  const dataSource = app.get(DataSource)
  const rateLimiter = app.get(RateLimitGuard)

  return {
    app,
    dataSource,
    agent: supertest.agent(app.getHttpServer()),
    close: () => app.close(),
    resetRateLimits: () => rateLimiter.reset(),
    newAgent: () => supertest.agent(app.getHttpServer()),
  }
}

/**
 * Empties every table between tests.
 *
 * The plan called for a transaction rolled back after each test, and that is
 * still the right tool for service-level tests. It cannot work here: requests go
 * through the HTTP server and each picks an arbitrary connection from the pool,
 * so a transaction opened on one QueryRunner is invisible to the code under test.
 * Truncation is slower but is the only approach that is actually correct for
 * full-stack tests.
 *
 * FOREIGN_KEY_CHECKS is session-scoped, so every statement here has to run on one
 * pinned connection; issuing them through the pool would let the SET and the
 * TRUNCATEs land on different connections.
 */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas.map((metadata) => metadata.tableName)
  const runner = dataSource.createQueryRunner()

  await runner.connect()
  try {
    await runner.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of tables) {
      await runner.query(`TRUNCATE TABLE \`${table}\``)
    }
    await runner.query('SET FOREIGN_KEY_CHECKS = 1')
  } finally {
    await runner.release()
  }
}

/**
 * Runs `work` inside a transaction that is always rolled back.
 *
 * The right harness for service- and repository-level tests, where the code under
 * test can be handed this EntityManager directly. Not usable for HTTP tests -- see
 * `truncateAll`.
 */
export async function withRollback(
  dataSource: DataSource,
  work: (manager: import('typeorm').EntityManager) => Promise<void>,
): Promise<void> {
  const runner = dataSource.createQueryRunner()
  await runner.connect()
  await runner.startTransaction()

  try {
    await work(runner.manager)
  } finally {
    // Rolled back whether the test passed or failed, so nothing leaks between tests.
    await runner.rollbackTransaction()
    await runner.release()
  }
}

/** Performs the SPA's bootstrap call and returns the CSRF token it hands out. */
export async function bootstrapCsrf(agent: TestAgent): Promise<string> {
  const response = await agent.get('/api/me').expect(200)
  return (response.body as { csrfToken: string }).csrfToken
}

export interface TestUser {
  username: string
  password: string
  bloogTitle: string
  user: PublicUser
  /** Valid for this agent until its session is regenerated again. */
  csrfToken: string
}

/**
 * Registers an account, which also logs the agent in. Returns the CSRF token
 * issued by that registration, so callers do not have to re-bootstrap.
 */
export async function registerUser(
  agent: TestAgent,
  overrides: Partial<Pick<TestUser, 'username' | 'password' | 'bloogTitle'>> = {},
): Promise<TestUser> {
  const credentials = {
    username: overrides.username ?? 'joe',
    password: overrides.password ?? 'correct horse battery',
    bloogTitle: overrides.bloogTitle ?? "Joe's Bloog",
  }

  const csrfToken = await bootstrapCsrf(agent)
  const response = await agent
    .post('/api/users')
    .set(CSRF_HEADER, csrfToken)
    .send(credentials)
    .expect(201)

  const body = response.body as SessionResponse
  if (!body.user) throw new Error('registration returned no user')

  return { ...credentials, user: body.user, csrfToken: body.csrfToken }
}

/**
 * Registration always creates a non-admin. Admin rights are granted out of band,
 * so tests that need one write the flag directly.
 */
export async function promoteToAdmin(dataSource: DataSource, username: string): Promise<void> {
  await dataSource.getRepository(UserEntity).update({ username }, { isAdmin: true })
}
