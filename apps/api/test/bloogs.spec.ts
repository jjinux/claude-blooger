import { CSRF_HEADER, type BloogSummary, type BloogWithPosts, type Page } from '@blooger/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, registerUser, type TestApp, type TestUser, truncateAll } from './harness.js'

describe('bloogs', () => {
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

  const addPost = (title: string) =>
    ctx.agent.post('/api/posts').set(CSRF_HEADER, joe.csrfToken).send({ title, body: 'x' })

  describe('listing', () => {
    it('is empty before anyone registers', async () => {
      await truncateAll(ctx.dataSource)

      const response = await ctx.newAgent().get('/api/bloogs').expect(200)
      const page = response.body as Page<BloogSummary>

      expect(page.items).toEqual([])
      expect(page.totalItems).toBe(0)
    })

    it('lists every bloog with its post count', async () => {
      await addPost('One').expect(201)
      await addPost('Two').expect(201)

      const janeAgent = ctx.newAgent()
      await registerUser(janeAgent, { username: 'jane', bloogTitle: 'Jane Bloogs' })

      const response = await ctx.agent.get('/api/bloogs').expect(200)
      const page = response.body as Page<BloogSummary>

      const byName = Object.fromEntries(page.items.map((bloog) => [bloog.username, bloog]))
      expect(page.totalItems).toBe(2)
      expect(byName.joe?.postCount).toBe(2)
      expect(byName.joe?.bloogTitle).toBe("Joe's Bloog")
      expect(byName.jane?.postCount).toBe(0)
    })

    it('reports a postless bloog as null rather than omitting it', async () => {
      const response = await ctx.agent.get('/api/bloogs').expect(200)
      const [bloog] = (response.body as Page<BloogSummary>).items

      // joe has registered but not posted: he must still appear.
      expect(bloog?.username).toBe('joe')
      expect(bloog?.postCount).toBe(0)
      expect(bloog?.latestPostAt).toBeNull()
    })

    it('reports the latest post timestamp', async () => {
      await addPost('One').expect(201)

      const response = await ctx.agent.get('/api/bloogs').expect(200)
      const [bloog] = (response.body as Page<BloogSummary>).items

      expect(bloog?.latestPostAt).not.toBeNull()
      expect(Number.isNaN(Date.parse(bloog?.latestPostAt ?? ''))).toBe(false)
    })

    it('paginates', async () => {
      for (const name of ['ann', 'bob', 'cat']) {
        await registerUser(ctx.newAgent(), { username: name, bloogTitle: `${name} bloog` })
      }

      const response = await ctx.agent.get('/api/bloogs?page=1&perPage=2').expect(200)
      const page = response.body as Page<BloogSummary>

      expect(page.items).toHaveLength(2)
      expect(page.totalItems).toBe(4)
      expect(page.totalPages).toBe(2)
    })
  })

  describe('a single bloog', () => {
    it('returns the bloog and a page of its posts', async () => {
      await addPost('One').expect(201)
      await addPost('Two').expect(201)

      const response = await ctx.agent.get('/api/bloogs/joe').expect(200)
      const body = response.body as BloogWithPosts

      expect(body.bloog.bloogTitle).toBe("Joe's Bloog")
      expect(body.bloog.postCount).toBe(2)
      expect(body.posts.items.map((post) => post.title)).toEqual(['Two', 'One'])
    })

    it("only shows that bloog's own posts", async () => {
      await addPost('Joe post').expect(201)

      const janeAgent = ctx.newAgent()
      const jane = await registerUser(janeAgent, { username: 'jane', bloogTitle: 'Jane Bloogs' })
      await janeAgent
        .post('/api/posts')
        .set(CSRF_HEADER, jane.csrfToken)
        .send({ title: 'Jane post', body: 'x' })
        .expect(201)

      const response = await ctx.agent.get('/api/bloogs/joe').expect(200)
      const body = response.body as BloogWithPosts

      expect(body.posts.items.map((post) => post.title)).toEqual(['Joe post'])
    })

    it('is found case-insensitively, matching the username collation', async () => {
      const response = await ctx.agent.get('/api/bloogs/JOE').expect(200)
      expect((response.body as BloogWithPosts).bloog.username).toBe('joe')
    })

    it('paginates the posts', async () => {
      for (let n = 1; n <= 3; n += 1) await addPost(`Post ${n}`).expect(201)

      const response = await ctx.agent.get('/api/bloogs/joe?page=2&perPage=2').expect(200)
      const body = response.body as BloogWithPosts

      expect(body.posts.items).toHaveLength(1)
      expect(body.posts.hasPrevious).toBe(true)
      expect(body.posts.hasNext).toBe(false)
    })

    it('404s for an unknown username', async () => {
      await ctx.agent.get('/api/bloogs/nobody').expect(404)
    })

    it('is readable without logging in', async () => {
      await ctx.newAgent().get('/api/bloogs/joe').expect(200)
    })
  })

  describe('pagination validation', () => {
    it('rejects page 0', async () => {
      await ctx.agent.get('/api/posts?page=0').expect(400)
    })

    it('rejects a perPage above the cap', async () => {
      await ctx.agent.get('/api/posts?perPage=1000').expect(400)
    })

    it('defaults to page 1 when nothing is given', async () => {
      const response = await ctx.agent.get('/api/posts').expect(200)
      expect((response.body as Page<unknown>).page).toBe(1)
    })
  })
})
