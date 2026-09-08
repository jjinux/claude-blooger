import { CSRF_HEADER, type AdminUser, type Page, type PostSummary } from '@blooger/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestApp,
  promoteToAdmin,
  registerUser,
  type TestApp,
  type TestUser,
  truncateAll,
} from './harness.js'
import type TestAgent from 'supertest/lib/agent.js'

describe('admin', () => {
  let ctx: TestApp
  let joe: TestUser
  let bossAgent: TestAgent
  let boss: TestUser

  beforeAll(async () => {
    ctx = await createTestApp()
  }, 30_000)

  afterAll(async () => {
    await ctx?.close()
  })

  beforeEach(async () => {
    await truncateAll(ctx.dataSource)
    ctx.resetRateLimits()

    joe = await registerUser(ctx.agent)
    bossAgent = ctx.newAgent()
    boss = await registerUser(bossAgent, { username: 'boss', bloogTitle: 'Boss Bloog' })
    await promoteToAdmin(ctx.dataSource, 'boss')
  })

  describe('access', () => {
    it('rejects an anonymous visitor with 401', async () => {
      await ctx.newAgent().get('/api/admin/users').expect(401)
    })

    it('rejects an ordinary logged-in user with 403', async () => {
      await ctx.agent.get('/api/admin/users').expect(403)
      await ctx.agent.get('/api/admin/posts').expect(403)
    })

    it('lets an admin in', async () => {
      await bossAgent.get('/api/admin/users').expect(200)
    })

    it('reflects a promotion without needing a fresh login', async () => {
      // The guard re-reads the user each request rather than trusting the session,
      // so rights granted mid-session take effect immediately.
      await ctx.agent.get('/api/admin/users').expect(403)
      await promoteToAdmin(ctx.dataSource, joe.username)
      await ctx.agent.get('/api/admin/users').expect(200)
    })
  })

  describe('users', () => {
    it('lists users with their post counts', async () => {
      await ctx.agent
        .post('/api/posts')
        .set(CSRF_HEADER, joe.csrfToken)
        .send({ title: 'One', body: 'x' })
        .expect(201)

      const response = await bossAgent.get('/api/admin/users').expect(200)
      const page = response.body as Page<AdminUser>

      const byName = Object.fromEntries(page.items.map((user) => [user.username, user]))
      expect(page.totalItems).toBe(2)
      expect(byName.joe?.postCount).toBe(1)
      expect(byName.joe?.isAdmin).toBe(false)
      expect(byName.boss?.isAdmin).toBe(true)
      expect(byName.boss?.postCount).toBe(0)
    })

    it('never exposes a password hash', async () => {
      const response = await bossAgent.get('/api/admin/users').expect(200)
      expect(JSON.stringify(response.body)).not.toContain('$argon2')
    })

    it('deletes a user and cascades to their posts', async () => {
      await ctx.agent
        .post('/api/posts')
        .set(CSRF_HEADER, joe.csrfToken)
        .send({ title: 'Doomed', body: 'x' })
        .expect(201)

      await bossAgent
        .delete(`/api/admin/users/${joe.user.id}`)
        .set(CSRF_HEADER, boss.csrfToken)
        .expect(204)

      const posts = await ctx.newAgent().get('/api/posts').expect(200)
      expect((posts.body as Page<PostSummary>).totalItems).toBe(0)

      await ctx.newAgent().get('/api/bloogs/joe').expect(404)
    })

    it('refuses to let an admin delete themselves', async () => {
      await bossAgent
        .delete(`/api/admin/users/${boss.user.id}`)
        .set(CSRF_HEADER, boss.csrfToken)
        .expect(400)
    })

    it('404s deleting a user that does not exist', async () => {
      await bossAgent.delete('/api/admin/users/999999').set(CSRF_HEADER, boss.csrfToken).expect(404)
    })

    it('still requires a CSRF token', async () => {
      await bossAgent.delete(`/api/admin/users/${joe.user.id}`).expect(403)
    })
  })

  describe('posts', () => {
    it('lists every post regardless of author', async () => {
      await ctx.agent
        .post('/api/posts')
        .set(CSRF_HEADER, joe.csrfToken)
        .send({ title: 'From joe', body: 'x' })
        .expect(201)
      await bossAgent
        .post('/api/posts')
        .set(CSRF_HEADER, boss.csrfToken)
        .send({ title: 'From boss', body: 'x' })
        .expect(201)

      const response = await bossAgent.get('/api/admin/posts').expect(200)
      const page = response.body as Page<PostSummary>

      expect(page.items.map((post) => post.title).sort()).toEqual(['From boss', 'From joe'])
    })
  })
})
