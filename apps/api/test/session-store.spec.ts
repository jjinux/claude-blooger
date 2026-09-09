import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SessionEntity } from '../src/auth/session.entity.js'
import { TypeOrmSessionStore } from '../src/auth/typeorm-session.store.js'
import { createTestApp, truncateAll, withRollback, type TestApp } from './harness.js'

const MINUTE = 60 * 1000

/**
 * `pruneExpired()` had no test, which is a fair part of how it came to be dead
 * code in the first place -- it was written, wired to nothing, and nothing
 * noticed for weeks.
 *
 * Service-level, so `withRollback` applies: the store is handed the
 * QueryRunner's own repository, and nothing it writes survives the test.
 */
describe('TypeOrmSessionStore.pruneExpired', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  // `pruneExpired()` and the count it returns are table-wide, so this has to
  // start from an empty table -- earlier spec files leave live sessions behind.
  // The truncation happens outside `withRollback`, because TRUNCATE commits
  // implicitly in MySQL and would end the transaction it was meant to run in.
  beforeEach(async () => {
    await truncateAll(ctx.dataSource)
  })

  it('deletes expired rows and leaves live ones alone', async () => {
    await withRollback(ctx.dataSource, async (manager) => {
      const sessions = manager.getRepository(SessionEntity)
      const store = new TypeOrmSessionStore(sessions)

      await sessions.insert([
        { id: 'stale-1', userId: null, expiresAt: new Date(Date.now() - MINUTE), data: '{}' },
        { id: 'stale-2', userId: null, expiresAt: new Date(Date.now() - 99 * MINUTE), data: '{}' },
        { id: 'live', userId: null, expiresAt: new Date(Date.now() + MINUTE), data: '{}' },
      ])

      expect(await store.pruneExpired()).toBe(2)

      const left = await sessions.find({ loadEagerRelations: false })
      expect(left.map((row) => row.id)).toEqual(['live'])
    })
  })

  it('reports zero when there is nothing to sweep', async () => {
    await withRollback(ctx.dataSource, async (manager) => {
      const store = new TypeOrmSessionStore(manager.getRepository(SessionEntity))
      expect(await store.pruneExpired()).toBe(0)
    })
  })

  /** A row that expired but has not been swept must still not authenticate. */
  it('refuses an expired session on read, sweep or no sweep', async () => {
    await withRollback(ctx.dataSource, async (manager) => {
      const sessions = manager.getRepository(SessionEntity)
      const store = new TypeOrmSessionStore(sessions)

      // `user_id` stays null: it is a foreign key, and this test is about expiry,
      // not about owning a real account.
      await sessions.insert({
        id: 'stale',
        userId: null,
        expiresAt: new Date(Date.now() - MINUTE),
        data: JSON.stringify({ cookie: {} }),
      })

      const loaded = await new Promise((resolve, reject) => {
        store.get('stale', (error, session) => (error ? reject(error) : resolve(session)))
      })

      expect(loaded).toBeNull()
      // Reading it also removed it.
      expect(await sessions.countBy({ id: 'stale' })).toBe(0)
    })
  })
})
