import { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../config/env.js'
import { PostEntity } from '../posts/post.entity.js'
import { UserEntity } from '../users/user.entity.js'
import { buildDataSourceOptions } from './data-source.js'

/**
 * Runs against the real blooger_test database. It proves three things that are
 * easy to break silently: that decorator metadata survives Vitest's transform,
 * that the migration builds a working schema, and that the query style this
 * project standardises on actually behaves as intended.
 */
describe('schema', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource(buildDataSourceOptions(loadEnv({ ...process.env, NODE_ENV: 'test' })))
    await dataSource.initialize()
    await dataSource.runMigrations()
  }, 30_000)

  afterAll(async () => {
    await dataSource?.destroy()
  })

  it('points at the test database, never the dev one', () => {
    expect(dataSource.options.database).toBe('blooger_test')
  })

  it('loads a post with its author in the house query style', async () => {
    const users = dataSource.getRepository(UserEntity)
    const posts = dataSource.getRepository(PostEntity)

    await dataSource.createQueryBuilder().delete().from(UserEntity).execute()

    const user = await users.save(
      users.create({
        username: 'testuser',
        passwordHash: 'not-a-real-hash',
        bloogTitle: 'Test Bloog',
        isAdmin: false,
      }),
    )
    const created = await posts.save(
      posts.create({ userId: user.id, title: 'Hello', body: '**hi**' }),
    )

    const found = await posts.findOneOrFail({
      where: { id: created.id },
      relations: { user: true },
      loadEagerRelations: false,
    })

    expect(found.title).toBe('Hello')
    expect(found.user?.username).toBe('testuser')
  })

  it('no longer accepts the 0.3-style string-array relations form', async () => {
    const posts = dataSource.getRepository(PostEntity)

    // Documents the upgrade hazard: `relations: ['user']` worked in 0.3. TypeORM
    // 1.x guards against it explicitly and points at the replacement, so this
    // fails loudly rather than silently returning unjoined rows.
    await expect(
      posts.find({ relations: ['user'] as never, loadEagerRelations: false }),
    ).rejects.toThrow(/String-array "relations" syntax has been removed/)
  })

  it('treats an empty where criteria as a mistake rather than "match everything"', async () => {
    const posts = dataSource.getRepository(PostEntity)
    await expect(posts.delete({})).rejects.toThrow()
  })

  it('throws on an undefined where value instead of matching every row', async () => {
    const posts = dataSource.getRepository(PostEntity)
    await expect(posts.findOneOrFail({ where: { id: undefined } })).rejects.toThrow()
  })
})
