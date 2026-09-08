import { randomBytes } from 'node:crypto'
import type { Request } from 'express'

/** express-session's API is callback-based; these keep the services async/await. */

export function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => (error ? reject(error) : resolve()))
  })
}

export function destroySession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => (error ? reject(error) : resolve()))
  })
}

export function saveSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => (error ? reject(error) : resolve()))
  })
}

export function newCsrfToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Every session carries a CSRF token, anonymous ones included: the SPA needs a
 * token before it can POST to /api/sessions to log in.
 */
export function ensureCsrfToken(request: Request): string {
  request.session.csrfToken ??= newCsrfToken()
  return request.session.csrfToken
}
