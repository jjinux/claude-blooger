import { CSRF_HEADER, type Page, type PostDetail, type PostSummary } from '@blooger/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestApp,
  promoteToAdmin,
  registerUser,
  type TestApp,
  type TestUser,
  truncateAll,
} from './harness.js'

describe('posts', () => {
  let ctx: TestApp
  let joe: TestUser

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
  })

  const create = (body = { title: 'Hello', body: '**hi**' }) =>
    ctx.agent.post('/api/posts').set(CSRF_HEADER, joe.csrfToken).send(body)

  describe('creating', () => {
    it('creates a post and renders its Markdown', async () => {
      const response = await create().expect(201)
      const post = response.body as PostDetail

      expect(post.title).toBe('Hello')
      expect(post.bodyHtml).toContain('<strong>hi</strong>')
      // The raw source comes back too, so the edit form has something to load.
      expect(post.body).toBe('**hi**')
      expect(post.author).toEqual({ username: 'joe', bloogTitle: "Joe's Bloog" })
    })

    it('requires a login', async () => {
      const anon = ctx.newAgent()
      const response = await anon.get('/api/me').expect(200)
      const token = (response.body as { csrfToken: string }).csrfToken

      await anon
        .post('/api/posts')
        .set(CSRF_HEADER, token)
        .send({ title: 'Hello', body: 'hi' })
        .expect(401)
    })

    it('requires a CSRF token', async () => {
      await ctx.agent.post('/api/posts').send({ title: 'Hello', body: 'hi' }).expect(403)
    })

    it('rejects a whitespace-only title', async () => {
      await create({ title: '   ', body: 'hi' }).expect(400)
    })

    it('trims surrounding whitespace, like the Rails strip_attributes did', async () => {
      const response = await create({ title: '  Spaced Out  ', body: '  hi  ' }).expect(201)
      expect((response.body as PostDetail).title).toBe('Spaced Out')
    })

    it('stores Markdown but never trusts it as HTML', async () => {
      const response = await create({ title: 'XSS', body: '<script>alert(1)</script>' }).expect(201)
      const post = response.body as PostDetail

      expect(post.bodyHtml).not.toMatch(/<\s*script/i)
      expect(post.body).toBe('<script>alert(1)</script>')
    })
  })

  describe('reading', () => {
    it('lists posts newest first', async () => {
      await create({ title: 'First', body: 'a' }).expect(201)
      await create({ title: 'Second', body: 'b' }).expect(201)

      const response = await ctx.agent.get('/api/posts').expect(200)
      const page = response.body as Page<PostSummary>

      expect(page.items.map((post) => post.title)).toEqual(['Second', 'First'])
      expect(page.totalItems).toBe(2)
    })

    it('paginates, and reports whether there is more', async () => {
      for (let n = 1; n <= 5; n += 1) await create({ title: `Post ${n}`, body: 'x' }).expect(201)

      const first = await ctx.agent.get('/api/posts?page=1&perPage=2').expect(200)
      const firstPage = first.body as Page<PostSummary>

      expect(firstPage.items).toHaveLength(2)
      expect(firstPage.totalPages).toBe(3)
      expect(firstPage.hasNext).toBe(true)
      expect(firstPage.hasPrevious).toBe(false)

      const last = await ctx.agent.get('/api/posts?page=3&perPage=2').expect(200)
      const lastPage = last.body as Page<PostSummary>

      expect(lastPage.items).toHaveLength(1)
      expect(lastPage.hasNext).toBe(false)
      expect(lastPage.hasPrevious).toBe(true)
    })

    it('does not repeat a post across pages when timestamps tie', async () => {
      for (let n = 1; n <= 6; n += 1) await create({ title: `Post ${n}`, body: 'x' }).expect(201)

      const seen: number[] = []
      for (const page of [1, 2, 3]) {
        const response = await ctx.agent.get(`/api/posts?page=${page}&perPage=2`).expect(200)
        seen.push(...(response.body as Page<PostSummary>).items.map((post) => post.id))
      }

      expect(new Set(seen).size).toBe(6)
    })

    it('rejects a non-numeric id with 400', async () => {
      await ctx.agent.get('/api/posts/not-a-number').expect(400)
    })

    it('returns 404 for a missing post', async () => {
      await ctx.agent.get('/api/posts/999999').expect(404)
    })

    it('is readable without logging in', async () => {
      await create().expect(201)
      await ctx.newAgent().get('/api/posts').expect(200)
    })
  })

  describe('ownership', () => {
    it('lets the author edit their own post', async () => {
      const created = (await create().expect(201)).body as PostDetail

      const response = await ctx.agent
        .patch(`/api/posts/${created.id}`)
        .set(CSRF_HEADER, joe.csrfToken)
        .send({ title: 'Edited' })
        .expect(200)

      expect((response.body as PostDetail).title).toBe('Edited')
    })

    it('stops another user editing it', async () => {
      const created = (await create().expect(201)).body as PostDetail

      const otherAgent = ctx.newAgent()
      const jane = await registerUser(otherAgent, { username: 'jane', bloogTitle: 'Jane' })

      await otherAgent
        .patch(`/api/posts/${created.id}`)
        .set(CSRF_HEADER, jane.csrfToken)
        .send({ title: 'Hijacked' })
        .expect(403)
    })

    it('stops another user deleting it', async () => {
      const created = (await create().expect(201)).body as PostDetail

      const otherAgent = ctx.newAgent()
      const jane = await registerUser(otherAgent, { username: 'jane', bloogTitle: 'Jane' })

      await otherAgent
        .delete(`/api/posts/${created.id}`)
        .set(CSRF_HEADER, jane.csrfToken)
        .expect(403)
    })

    it("lets an admin edit anyone else's post", async () => {
      const created = (await create().expect(201)).body as PostDetail

      const adminAgent = ctx.newAgent()
      const admin = await registerUser(adminAgent, { username: 'boss', bloogTitle: 'Boss' })
      await promoteToAdmin(ctx.dataSource, 'boss')

      await adminAgent
        .patch(`/api/posts/${created.id}`)
        .set(CSRF_HEADER, admin.csrfToken)
        .send({ title: 'Moderated' })
        .expect(200)
    })

    it('lets the author delete their own post', async () => {
      const created = (await create().expect(201)).body as PostDetail

      await ctx.agent.delete(`/api/posts/${created.id}`).set(CSRF_HEADER, joe.csrfToken).expect(204)

      await ctx.agent.get(`/api/posts/${created.id}`).expect(404)
    })
  })

  describe('cascade', () => {
    it("removes a user's posts when the user is deleted", async () => {
      await create().expect(201)

      await ctx.dataSource.query('DELETE FROM users WHERE username = ?', ['joe'])

      const response = await ctx.newAgent().get('/api/posts').expect(200)
      expect((response.body as Page<PostSummary>).totalItems).toBe(0)
    })
  })
})
