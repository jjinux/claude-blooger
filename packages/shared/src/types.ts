/**
 * Wire shapes shared by the API and the SPA.
 *
 * Every one of these is inferred from the matching schema in `responses.ts`, so
 * the types, the runtime validation in the tests, and the OpenAPI document at
 * /api/docs all come from one declaration.
 *
 * The imports below are `import type`, which matters: this module is re-exported
 * by `contracts.ts`, which the browser bundle imports. A value import of the
 * schemas would drag zod in with it. Type-only imports are erased entirely, so
 * the emitted `types.js` is empty and costs the SPA nothing.
 */
import type { z } from 'zod'
import type {
  adminUserSchema,
  bloogSummarySchema,
  bloogWithPostsSchema,
  postAuthorSchema,
  postDetailSchema,
  postSummarySchema,
  publicUserSchema,
  sessionResponseSchema,
} from './responses.js'

/** A user as the API is willing to expose it. Never carries the password hash. */
export type PublicUser = z.infer<typeof publicUserSchema>

/**
 * Returned by GET /api/me. The SPA calls it on boot to learn who it is and to
 * pick up the CSRF token it must echo on every mutating request.
 */
export type SessionResponse = z.infer<typeof sessionResponseSchema>

/**
 * Envelope returned by every paginated endpoint.
 *
 * Hand-written rather than inferred, because `pageSchema()` is a function and
 * there is no single schema to infer a generic from. `pageSchema` produces
 * exactly this shape; a test parses real responses to prove it.
 */
export interface Page<T> {
  items: T[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

export type PostAuthor = z.infer<typeof postAuthorSchema>
export type PostSummary = z.infer<typeof postSummarySchema>

/** Adds the Markdown source, which only the edit form needs. */
export type PostDetail = z.infer<typeof postDetailSchema>

export type BloogSummary = z.infer<typeof bloogSummarySchema>
export type BloogWithPosts = z.infer<typeof bloogWithPostsSchema>

/** A user as the /admin section sees them: adds the id, role, and post count. */
export type AdminUser = z.infer<typeof adminUserSchema>
