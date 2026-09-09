import { CSRF_HEADER, type ErrorResponse, type FieldError } from '@blooger/shared/contracts'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * The CSRF token for the current session, refreshed every time /api/me is read
 * and every time a login or registration issues a new one.
 *
 * Module state rather than React state on purpose: `request` is called from
 * mutation functions that are not components, and the token is a property of the
 * browser session, not of any particular part of the tree.
 */
let csrfToken: string | null = null

export function rememberCsrfToken(token: string): void {
  csrfToken = token || null
}

/**
 * Fetches a CSRF token straight from /api/me.
 *
 * Normally `useSession` has already supplied one, but relying on that alone
 * couples every mutation to a component being mounted somewhere above it. This
 * makes the client self-sufficient: a mutation can always obtain a token, and a
 * token that has gone stale (the server regenerates the session on login) can be
 * replaced without a reload.
 */
async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await fetch('/api/me', { credentials: 'same-origin' })
    if (!response.ok) return

    const session = (await response.json()) as { csrfToken?: string }
    if (session.csrfToken) csrfToken = session.csrfToken
  } catch {
    // Leave the token as it was; the request below will report the real failure.
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** The message for one field, so a form can render it next to the input. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors.find((error) => error.field === field)?.message
  }
}

/**
 * The server gives every failure the same body -- see `errorResponseSchema` in
 * @blooger/shared, which an exception filter enforces. This stays defensive
 * anyway: a proxy, a gateway, or a network stall can put something else on the
 * wire, and a login form should say so rather than throw a parse error.
 */
function toApiError(status: number, body: unknown): ApiError {
  const parsed = (body ?? {}) as Partial<ErrorResponse>
  const message =
    typeof parsed.message === 'string' ? parsed.message : `Request failed with status ${status}`

  return new ApiError(status, message, parsed.errors ?? [])
}

async function request<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
  const method = init.method ?? 'GET'
  const mutating = !SAFE_METHODS.has(method)

  if (mutating && csrfToken === null) await fetchCsrfToken()

  const headers = new Headers(init.headers)

  if (init.body !== undefined) headers.set('content-type', 'application/json')
  if (mutating && csrfToken !== null) headers.set(CSRF_HEADER, csrfToken)

  let response: Response
  try {
    response = await fetch(path, { ...init, method, headers, credentials: 'same-origin' })
  } catch {
    // A network failure is not an HTTP status, but callers still want one shape.
    throw new ApiError(0, 'Could not reach the server. Is the API running?')
  }

  // A rejected token means the session was regenerated underneath us. Fetch the
  // current one and try once more; a second failure is a real error.
  if (response.status === 403 && mutating && canRetry) {
    const previous = csrfToken
    await fetchCsrfToken()
    if (csrfToken !== previous) return request<T>(path, init, false)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text }
    }
  }

  if (!response.ok) throw toApiError(response.status, body)
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Builds `?page=&perPage=` without leaving a trailing `?` when both are default. */
export function pageQuery(page: number, perPage?: number): string {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (perPage !== undefined) params.set('perPage', String(perPage))
  const query = params.toString()
  return query ? `?${query}` : ''
}
