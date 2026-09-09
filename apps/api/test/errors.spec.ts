import { CSRF_HEADER, errorResponseSchema } from '@blooger/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bootstrapCsrf, createTestApp, registerUser, truncateAll, type TestApp } from './harness.js'

/**
 * One shape for every failure.
 *
 * Each case parses the body with `errorResponseSchema` -- the same schema the SPA
 * types against and the OpenAPI document publishes -- rather than picking at
 * individual keys. A response that grew an extra field, or lost `statusCode`,
 * fails here.
 */
describe('error responses', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  beforeEach(async () => {
    await truncateAll(ctx.dataSource)
    ctx.resetRateLimits()
  })

  it('reports a validation failure per field', async () => {
    const csrfToken = await bootstrapCsrf(ctx.agent)

    const response = await ctx.agent
      .post('/api/users')
      .set(CSRF_HEADER, csrfToken)
      .send({ username: 'x', bloogTitle: '', password: 'short' })
      .expect(400)

    const body = errorResponseSchema.parse(response.body)

    expect(body.statusCode).toBe(400)
    expect(body.error).toBe('Bad Request')
    expect(body.message).toBe('Validation failed')
    expect(body.errors?.map((error) => error.field).sort()).toEqual([
      'bloogTitle',
      'password',
      'username',
    ])
  })

  it('names the nested field, not just the root', async () => {
    const { csrfToken } = await registerUser(ctx.agent)

    const response = await ctx.agent
      .post('/api/posts')
      .set(CSRF_HEADER, csrfToken)
      .send({ title: '', body: '' })
      .expect(400)

    const body = errorResponseSchema.parse(response.body)
    expect(body.errors?.map((error) => error.field)).toContain('title')
  })

  it('uses the same shape for a 404 from a handler', async () => {
    const response = await ctx.agent.get('/api/posts/999999').expect(404)

    const body = errorResponseSchema.parse(response.body)
    expect(body).toMatchObject({ statusCode: 404, error: 'Not Found' })
    expect(body.errors).toBeUndefined()
  })

  it('uses the same shape for an unrouted /api path', async () => {
    const response = await ctx.agent.get('/api/nope').expect(404)

    const body = errorResponseSchema.parse(response.body)
    expect(body).toMatchObject({ statusCode: 404, error: 'Not Found' })
  })

  it('uses the same shape for a rejected CSRF token', async () => {
    const response = await ctx.agent
      .post('/api/sessions')
      .send({ username: 'joe', password: 'whatever' })
      .expect(403)

    const body = errorResponseSchema.parse(response.body)
    expect(body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
  })

  it('uses the same shape for an unauthenticated request', async () => {
    const response = await ctx.agent.get('/api/account').expect(401)

    const body = errorResponseSchema.parse(response.body)
    expect(body).toMatchObject({ statusCode: 401, error: 'Unauthorized' })
  })

  it('uses the same shape for a duplicate username', async () => {
    const { csrfToken } = await registerUser(ctx.agent)

    const response = await ctx.agent
      .post('/api/users')
      .set(CSRF_HEADER, csrfToken)
      .send({ username: 'joe', bloogTitle: 'Another', password: 'correct horse battery' })
      .expect(409)

    const body = errorResponseSchema.parse(response.body)
    expect(body).toMatchObject({ statusCode: 409, error: 'Conflict' })
  })

  it('answers a rate limit with Retry-After rather than a bespoke field', async () => {
    const csrfToken = await bootstrapCsrf(ctx.agent)
    const attempt = () =>
      ctx.agent
        .post('/api/sessions')
        .set(CSRF_HEADER, csrfToken)
        .send({ username: 'nobody', password: 'wrong password' })

    // The limit is 10 a minute; the eleventh is refused.
    for (let n = 0; n < 10; n += 1) await attempt().expect(401)
    const response = await attempt().expect(429)

    const body = errorResponseSchema.parse(response.body)
    expect(body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' })
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
    expect(response.body).not.toHaveProperty('retryAfterSeconds')
  })
})
