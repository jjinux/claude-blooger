import { timingSafeEqual } from 'node:crypto'
import { CSRF_HEADER } from '@blooger/shared'
import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { Request } from 'express'

/** Methods that must not change state, and so need no token. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  // timingSafeEqual throws on a length mismatch, and the lengths themselves are
  // not secret, so compare them first.
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Synchronizer-token CSRF protection, registered globally.
 *
 * The token lives in the session and is handed to the SPA by GET /api/me. A
 * cross-origin attacker can force the browser to send the session cookie, but
 * CORS stops them reading that response, so they never learn the token.
 *
 * Login and registration are deliberately *not* exempt: the SPA fetches /api/me
 * on boot anyway, so it always holds a token before it posts anything.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true

    const request = context.switchToHttp().getRequest<Request>()
    if (SAFE_METHODS.has(request.method)) return true

    const expected = request.session?.csrfToken
    const provided = request.get(CSRF_HEADER)

    if (!expected || !provided || !constantTimeEquals(provided, expected)) {
      throw new ForbiddenException('Missing or invalid CSRF token')
    }

    return true
  }
}
