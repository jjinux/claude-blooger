import { errorResponseSchema } from '@blooger/shared'
import { applyDecorators } from '@nestjs/common'
import { ApiCookieAuth, ApiResponse } from '@nestjs/swagger'

/** The name of the security scheme, shared by the definition and every use. */
export const SESSION_SECURITY_SCHEME = 'session'

/** Marks a route as requiring the session cookie. */
export const ApiSession = () => ApiCookieAuth(SESSION_SECURITY_SCHEME)

/**
 * What each status means in this API, said once.
 *
 * Repeating these strings on 18 handlers is how they end up describing four
 * slightly different things.
 */
const DESCRIPTIONS: Record<number, string> = {
  400: 'The body or query failed validation. `errors` names the offending fields.',
  401: 'No session. Log in first.',
  403: 'Missing or stale CSRF token, or this account may not do that.',
  404: 'No such record.',
  409: 'That username is taken.',
  429: 'Too many attempts. The `Retry-After` header says how long to wait.',
}

/**
 * Documents the failures a handler can produce, all sharing `ErrorResponse`.
 *
 * Only the ones a caller can actually provoke: 500 is on every endpoint and says
 * nothing, and listing it everywhere just makes the document longer.
 */
export function ApiErrors(...statuses: (keyof typeof DESCRIPTIONS | number)[]): MethodDecorator {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status: Number(status),
        description: DESCRIPTIONS[Number(status)],
        standardSchema: errorResponseSchema,
      }),
    ),
  )
}
