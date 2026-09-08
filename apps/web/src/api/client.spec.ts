import { CSRF_HEADER } from '@blooger/shared/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, rememberCsrfToken } from './client'
import { mockFetch } from '../test/render'

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    rememberCsrfToken('')
  })

  it('does not send a CSRF token on a GET', async () => {
    const calls = mockFetch({ 'GET /api/me': { body: { user: null, csrfToken: 'tok' } } })
    rememberCsrfToken('tok')

    await api.get('/api/me')

    expect(calls[0]?.headers.get(CSRF_HEADER)).toBeNull()
  })

  it('sends the CSRF token on a mutating request', async () => {
    const calls = mockFetch({ 'POST /api/posts': { status: 201, body: {} } })
    rememberCsrfToken('tok')

    await api.post('/api/posts', { title: 'x', body: 'y' })

    expect(calls[0]?.headers.get(CSRF_HEADER)).toBe('tok')
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
  })

  it('sends cookies, which is how the session travels', async () => {
    mockFetch({ 'GET /api/me': { body: {} } })
    const spy = vi.mocked(fetch)

    await api.get('/api/me')

    expect(spy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin' })
  })

  it('returns undefined for a 204 rather than trying to parse a body', async () => {
    mockFetch({ 'DELETE /api/sessions': { status: 204 } })
    await expect(api.delete('/api/sessions')).resolves.toBeUndefined()
  })

  it('turns an error response into an ApiError carrying the status', async () => {
    mockFetch({
      'POST /api/sessions': { status: 401, body: { message: 'Incorrect username or password' } },
    })

    await expect(api.post('/api/sessions', {})).rejects.toMatchObject({
      status: 401,
      message: 'Incorrect username or password',
    })
  })

  it('exposes per-field validation errors', async () => {
    mockFetch({
      'POST /api/users': {
        status: 400,
        body: {
          message: 'Validation failed',
          errors: [{ field: 'password', message: 'too short' }],
        },
      },
    })

    const error = await api.post('/api/users', {}).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldError('password')).toBe('too short')
    expect((error as ApiError).fieldError('username')).toBeUndefined()
  })

  it('fetches a CSRF token by itself when it has none', async () => {
    // Nothing has mounted useSession, so the client must bootstrap on its own
    // rather than sending a mutation with no token and taking a 403.
    const calls = mockFetch({
      'GET /api/me': { body: { user: null, csrfToken: 'fetched-token' } },
      'POST /api/posts': { status: 201, body: {} },
    })

    await api.post('/api/posts', { title: 'x', body: 'y' })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET /api/me',
      'POST /api/posts',
    ])
    expect(calls[1]?.headers.get(CSRF_HEADER)).toBe('fetched-token')
  })

  it('refreshes a stale token and retries once after a 403', async () => {
    rememberCsrfToken('stale')

    let attempts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init: RequestInit = {}) => {
        if (input === '/api/me') {
          return Promise.resolve(
            new Response(JSON.stringify({ user: null, csrfToken: 'fresh' }), { status: 200 }),
          )
        }

        attempts += 1
        const token = new Headers(init.headers).get(CSRF_HEADER)
        const ok = token === 'fresh'

        return Promise.resolve(
          new Response(
            JSON.stringify(ok ? { id: 1 } : { message: 'Missing or invalid CSRF token' }),
            {
              status: ok ? 201 : 403,
            },
          ),
        )
      }),
    )

    await expect(api.post('/api/posts', {})).resolves.toEqual({ id: 1 })
    expect(attempts).toBe(2)
  })

  it('gives up rather than looping when the refreshed token is also rejected', async () => {
    rememberCsrfToken('stale')

    let attempts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input === '/api/me') {
          return Promise.resolve(
            new Response(JSON.stringify({ user: null, csrfToken: `t${attempts}` }), {
              status: 200,
            }),
          )
        }
        attempts += 1
        return Promise.resolve(new Response(JSON.stringify({ message: 'nope' }), { status: 403 }))
      }),
    )

    await expect(api.post('/api/posts', {})).rejects.toMatchObject({ status: 403 })
    expect(attempts).toBe(2)
  })

  it('reports a network failure as a readable error, not a raw TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(api.get('/api/me')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('Could not reach the server'),
    })
  })
})
