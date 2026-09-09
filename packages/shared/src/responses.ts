import { z } from 'zod'

/**
 * The response shapes, as schemas.
 *
 * They exist for two reasons: `@nestjs/swagger` turns them into the OpenAPI
 * document at /api/docs, and the wire types in `types.ts` are inferred from them,
 * so what is documented and what is typed cannot drift apart. They are not
 * enforced at runtime on the way out -- a test parses real responses through them
 * instead, which keeps the cost off the request path.
 *
 * `.describe()` is not decoration: it is what the generated documentation shows.
 */

/** A user as the API is willing to expose it. Never carries the password hash. */
export const publicUserSchema = z.object({
  id: z.int(),
  username: z.string(),
  bloogTitle: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.iso.datetime(),
})

/** Returned by GET /api/me: who you are, plus the token every mutation must echo. */
export const sessionResponseSchema = z.object({
  user: publicUserSchema.nullable().describe('Null when nobody is logged in.'),
  csrfToken: z.string(),
})

/** The envelope every paginated endpoint returns. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int(),
    perPage: z.int(),
    totalItems: z.int(),
    totalPages: z.int(),
    hasPrevious: z.boolean(),
    hasNext: z.boolean(),
  })
}

export const postAuthorSchema = z.object({
  username: z.string(),
  bloogTitle: z.string(),
})

export const postSummarySchema = z.object({
  id: z.int(),
  title: z.string(),
  bodyHtml: z.string().describe('Rendered and sanitized on the server. Do not re-render it.'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  author: postAuthorSchema,
})

/** Adds the Markdown source, which only the edit form needs. */
export const postDetailSchema = postSummarySchema.extend({
  body: z.string().describe('The Markdown source.'),
})

export const bloogSummarySchema = z.object({
  username: z.string(),
  bloogTitle: z.string(),
  postCount: z.int(),
  latestPostAt: z.iso.datetime().nullable(),
})

export const bloogWithPostsSchema = z.object({
  bloog: bloogSummarySchema,
  posts: pageSchema(postSummarySchema),
})

/** A user as the /admin section sees them: adds the id, role, and post count. */
export const adminUserSchema = z.object({
  id: z.int(),
  username: z.string(),
  bloogTitle: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.iso.datetime(),
  postCount: z.int(),
})

export const postSummaryPageSchema = pageSchema(postSummarySchema)
export const bloogSummaryPageSchema = pageSchema(bloogSummarySchema)
export const adminUserPageSchema = pageSchema(adminUserSchema)
