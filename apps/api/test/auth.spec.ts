import { CSRF_HEADER, type SessionResponse } from '@blooger/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bootstrapCsrf, createTestApp, type TestApp, truncateAll } from './harness.js'

// Always fetch the CSRF token into a variable *before* building the request that
// uses it. supertest's agent attaches its cookie jar when the request object is
// constructed, so `.set(HEADER, await bootstrapCsrf(...))` would send the token
// from a session the request itself is not carrying.

const CREDENTIALS = {
  username: 'joe',
  password: 'correct horse battery',
  bloogTitle: "Joe's Bloog",
}

describe('auth', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = await createTestApp()
  }, 30_000)

  afterAll(async () => {
    await ctx?.close()
  })

  beforeEach(async () => {
    await truncateAll(ctx.dataSource)
    // Otherwise one spec's login attempts would exhaust the limit for the next.
    ctx.resetRateLimits()
  })

  async function register(agent = ctx.agent) {
    const csrfToken = await bootstrapCsrf(agent)
    const response = await agent
      .post('/api/users')
      .set(CSRF_HEADER, csrfToken)
      .send(CREDENTIALS)
      .expect(201)
    return { body: response.body as SessionResponse, csrfToken }
  }

  describe('registration', () => {
    it('creates an account and logs it in', async () => {
      const { body } = await register()

      expect(body.user).toMatchObject({
        username: 'joe',
        bloogTitle: "Joe's Bloog",
        isAdmin: false,
      })

      const me = await ctx.agent.get('/api/me').expect(200)
      expect((me.body as SessionResponse).user?.username).toBe('joe')
    })

    it('never returns the password hash', async () => {
      const { body } = await register()
      expect(JSON.stringify(body)).not.toContain('$argon2')
      expect(body.user).not.toHaveProperty('passwordHash')
    })

    it('rejects a duplicate username with 409, not a 500', async () => {
      await register()

      const csrfToken = await bootstrapCsrf(ctx.agent)
      await ctx.agent.post('/api/users').set(CSRF_HEADER, csrfToken).send(CREDENTIALS).expect(409)
    })

    it('rejects a duplicate that differs only in case', async () => {
      await register()

      const csrfToken = await bootstrapCsrf(ctx.agent)
      await ctx.agent
        .post('/api/users')
        .set(CSRF_HEADER, csrfToken)
        .send({ ...CREDENTIALS, username: 'JOE' })
        .expect(409)
    })

    it('rejects a short password with a field-level error', async () => {
      const csrfToken = await bootstrapCsrf(ctx.agent)
      const response = await ctx.agent
        .post('/api/users')
        .set(CSRF_HEADER, csrfToken)
        .send({ ...CREDENTIALS, password: 'short' })
        .expect(400)

      const body = response.body as { errors: Array<{ field: string }> }
      expect(body.errors.map((error) => error.field)).toContain('password')
    })

    it('ignores an isAdmin field smuggled into the body', async () => {
      const csrfToken = await bootstrapCsrf(ctx.agent)
      const response = await ctx.agent
        .post('/api/users')
        .set(CSRF_HEADER, csrfToken)
        .send({ ...CREDENTIALS, isAdmin: true })
        .expect(201)

      expect((response.body as SessionResponse).user?.isAdmin).toBe(false)
    })
  })

  describe('csrf', () => {
    it('rejects a mutating request with no token', async () => {
      await bootstrapCsrf(ctx.agent)
      await ctx.agent.post('/api/users').send(CREDENTIALS).expect(403)
    })

    it('rejects a mutating request with the wrong token', async () => {
      await bootstrapCsrf(ctx.agent)
      await ctx.agent
        .post('/api/users')
        .set(CSRF_HEADER, 'not-the-real-token')
        .send(CREDENTIALS)
        .expect(403)
    })

    it('allows safe methods with no token', async () => {
      await ctx.agent.get('/api/me').expect(200)
    })
  })

  describe('login', () => {
    it('accepts the right password', async () => {
      await register()
      const csrf1 = await bootstrapCsrf(ctx.agent)
      await ctx.agent.delete('/api/sessions').set(CSRF_HEADER, csrf1).expect(204)

      const csrfToken = await bootstrapCsrf(ctx.agent)
      const response = await ctx.agent
        .post('/api/sessions')
        .set(CSRF_HEADER, csrfToken)
        .send({ username: 'joe', password: CREDENTIALS.password })
        .expect(200)

      expect((response.body as SessionResponse).user?.username).toBe('joe')
    })

    it('rejects a wrong password with 401', async () => {
      await register()

      const csrfToken = await bootstrapCsrf(ctx.agent)
      await ctx.agent
        .post('/api/sessions')
        .set(CSRF_HEADER, csrfToken)
        .send({ username: 'joe', password: 'wrong' })
        .expect(401)
    })

    it('gives an unknown username the same response as a wrong password', async () => {
      const csrfToken = await bootstrapCsrf(ctx.agent)
      const response = await ctx.agent
        .post('/api/sessions')
        .set(CSRF_HEADER, csrfToken)
        .send({ username: 'nobody', password: 'wrong' })
        .expect(401)

      // Identical wording is what stops the endpoint being a username oracle.
      expect((response.body as { message: string }).message).toBe('Incorrect username or password')
    })

    it('issues a new session id on login, defeating session fixation', async () => {
      await register()
      const csrf2 = await bootstrapCsrf(ctx.agent)
      await ctx.agent.delete('/api/sessions').set(CSRF_HEADER, csrf2).expect(204)

      const before = await ctx.agent.get('/api/me').expect(200)
      const cookieBefore = before.headers['set-cookie']?.[0]

      const login = await ctx.agent
        .post('/api/sessions')
        .set(CSRF_HEADER, (before.body as SessionResponse).csrfToken)
        .send({ username: 'joe', password: CREDENTIALS.password })
        .expect(200)

      const cookieAfter = login.headers['set-cookie']?.[0]
      expect(cookieAfter).toBeDefined()
      expect(cookieAfter).not.toBe(cookieBefore)
    })

    it('sets an httpOnly, lax, non-secure cookie outside production', async () => {
      const response = await ctx.agent.get('/api/me').expect(200)
      const cookie = response.headers['set-cookie']?.[0] ?? ''

      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).not.toContain('Secure')
    })

    it('rate-limits repeated failed logins', async () => {
      await register()
      const csrfToken = await bootstrapCsrf(ctx.agent)

      const attempt = () =>
        ctx.agent
          .post('/api/sessions')
          .set(CSRF_HEADER, csrfToken)
          .send({ username: 'joe', password: 'wrong' })

      // The limit is 10 per minute; the eleventh must be turned away.
      for (let i = 0; i < 10; i += 1) await attempt().expect(401)
      await attempt().expect(429)
    })
  })

  describe('logout', () => {
    it('clears the session', async () => {
      await register()

      const csrf3 = await bootstrapCsrf(ctx.agent)
      await ctx.agent.delete('/api/sessions').set(CSRF_HEADER, csrf3).expect(204)

      const me = await ctx.agent.get('/api/me').expect(200)
      expect((me.body as SessionResponse).user).toBeNull()
    })
  })

  describe('account', () => {
    it('is not reachable when logged out', async () => {
      await ctx.agent.get('/api/account').expect(401)
    })

    it('updates the bloog title', async () => {
      await register()

      const csrf4 = await bootstrapCsrf(ctx.agent)
      const response = await ctx.agent
        .patch('/api/account')
        .set(CSRF_HEADER, csrf4)
        .send({ bloogTitle: 'A Better Title' })
        .expect(200)

      expect((response.body as { bloogTitle: string }).bloogTitle).toBe('A Better Title')
    })

    it('refuses a password change without the current password', async () => {
      await register()

      const csrf5 = await bootstrapCsrf(ctx.agent)
      await ctx.agent
        .patch('/api/account')
        .set(CSRF_HEADER, csrf5)
        .send({ newPassword: 'a brand new password' })
        .expect(400)
    })

    it('refuses a password change when the current password is wrong', async () => {
      await register()

      const csrf6 = await bootstrapCsrf(ctx.agent)
      await ctx.agent
        .patch('/api/account')
        .set(CSRF_HEADER, csrf6)
        .send({ currentPassword: 'not it', newPassword: 'a brand new password' })
        .expect(400)
    })

    it('changes the password, and the new one works', async () => {
      await register()
      const newPassword = 'a brand new password'

      const csrf7 = await bootstrapCsrf(ctx.agent)
      await ctx.agent
        .patch('/api/account')
        .set(CSRF_HEADER, csrf7)
        .send({ currentPassword: CREDENTIALS.password, newPassword })
        .expect(200)

      const csrf8 = await bootstrapCsrf(ctx.agent)
      await ctx.agent.delete('/api/sessions').set(CSRF_HEADER, csrf8).expect(204)

      const csrf9 = await bootstrapCsrf(ctx.agent)
      await ctx.agent
        .post('/api/sessions')
        .set(CSRF_HEADER, csrf9)
        .send({ username: 'joe', password: newPassword })
        .expect(200)
    })
  })
})
