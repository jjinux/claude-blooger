import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  // Retries off so a failed query surfaces its error immediately instead of
  // making the test wait out the default backoff.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

export interface MockResponse {
  status?: number
  body?: unknown
}

export interface RecordedCall {
  url: string
  method: string
  headers: Headers
  body: unknown
}

/**
 * Stubs `fetch` with a tiny router keyed by "METHOD /path", and records every
 * call so a test can assert on the headers that were actually sent.
 */
export function mockFetch(routes: Record<string, MockResponse>): RecordedCall[] {
  const calls: RecordedCall[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      const headers = new Headers(init.headers)

      calls.push({
        url: input,
        method,
        headers,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      })

      const match = routes[`${method} ${input}`] ?? routes[input]
      const status = match?.status ?? (match ? 200 : 404)
      const payload = match?.body ?? { message: `No mock for ${method} ${input}` }

      return Promise.resolve(
        new Response(status === 204 ? null : JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }),
  )

  return calls
}

export const SESSION_ANON = { user: null, csrfToken: 'test-token' }

export const USER_JOE = {
  id: 1,
  username: 'joe',
  bloogTitle: "Joe's Bloog",
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const SESSION_JOE = { user: USER_JOE, csrfToken: 'test-token' }

export function post(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Hello',
    body: '**hi**',
    bodyHtml: '<p><strong>hi</strong></p>',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    author: { username: 'joe', bloogTitle: "Joe's Bloog" },
    ...overrides,
  }
}

export function page<T>(items: T[], overrides: Record<string, unknown> = {}) {
  return {
    items,
    page: 1,
    perPage: 10,
    totalItems: items.length,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
    ...overrides,
  }
}
