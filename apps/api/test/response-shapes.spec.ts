import {
  adminUserPageSchema,
  bloogSummaryPageSchema,
  bloogWithPostsSchema,
  CSRF_HEADER,
  postDetailSchema,
  postSummaryPageSchema,
  publicUserSchema,
  sessionResponseSchema,
} from '@blooger/shared'
import type { ZodType } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createTestApp,
  promoteToAdmin,
  registerUser,
  truncateAll,
  type TestApp,
} from './harness.js'

/**
 * Proves the response schemas describe what the API actually sends.
 *
 * They are documentation -- /api/docs is generated from them and the wire types
 * are inferred from them -- and documentation that nothing checks drifts. Nothing
 * validates responses on the way out, deliberately: that cost belongs in a test,
 * not on every request.
 *
 * `parse` strips unknown keys, so comparing the parsed value against the original
 * catches a field the schema does not know about as well as one it requires and
 * the API omits. Asserting only `parse` succeeded would miss the first kind.
 */
function expectShape(schema: ZodType, body: unknown): void {
  expect(schema.parse(body)).toEqual(body)
}

describe('response shapes match the published schemas', () => {
  let ctx: TestApp
  let postId: number

  beforeAll(async () => {
    ctx = await createTestApp()
    await truncateAll(ctx.dataSource)

    const { csrfToken } = await registerUser(ctx.agent)
    const created = await ctx.agent
      .post('/api/posts')
      .set(CSRF_HEADER, csrfToken)
      .send({ title: 'A post', body: 'With a **body**.' })
      .expect(201)

    postId = (created.body as { id: number }).id
    await promoteToAdmin(ctx.dataSource, 'joe')
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('GET /api/me', async () => {
    const { body } = await ctx.agent.get('/api/me').expect(200)
    expectShape(sessionResponseSchema, body)
  })

  it('GET /api/account', async () => {
    const { body } = await ctx.agent.get('/api/account').expect(200)
    expectShape(publicUserSchema, body)
  })

  it('GET /api/posts', async () => {
    const { body } = await ctx.agent.get('/api/posts').expect(200)
    expectShape(postSummaryPageSchema, body)
  })

  it('GET /api/posts/:id', async () => {
    const { body } = await ctx.agent.get(`/api/posts/${postId}`).expect(200)
    expectShape(postDetailSchema, body)
  })

  it('GET /api/bloogs', async () => {
    const { body } = await ctx.agent.get('/api/bloogs').expect(200)
    expectShape(bloogSummaryPageSchema, body)
  })

  it('GET /api/bloogs/:username', async () => {
    const { body } = await ctx.agent.get('/api/bloogs/joe').expect(200)
    expectShape(bloogWithPostsSchema, body)
  })

  it('GET /api/admin/users', async () => {
    const { body } = await ctx.agent.get('/api/admin/users').expect(200)
    expectShape(adminUserPageSchema, body)
  })

  it('GET /api/admin/posts', async () => {
    const { body } = await ctx.agent.get('/api/admin/posts').expect(200)
    expectShape(postSummaryPageSchema, body)
  })
})
