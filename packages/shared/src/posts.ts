import { z } from 'zod'
import type { Page } from './pagination'

export const POST_TITLE_MAX_LENGTH = 255
/** Generous, but bounded: `body` is a MySQL TEXT column (65,535 bytes). */
export const POST_BODY_MAX_LENGTH = 60_000

/**
 * `.trim()` is the equivalent of the Rails app's `strip_attributes`: it stops a
 * title of pure whitespace passing `.min(1)`, and keeps stored data tidy.
 */
export const postTitleSchema = z.string().trim().min(1).max(POST_TITLE_MAX_LENGTH)
export const postBodySchema = z.string().trim().min(1).max(POST_BODY_MAX_LENGTH)

export const createPostSchema = z.object({
  title: postTitleSchema,
  body: postBodySchema,
})
export type CreatePostInput = z.infer<typeof createPostSchema>

export const updatePostSchema = z
  .object({
    title: postTitleSchema.optional(),
    body: postBodySchema.optional(),
  })
  .refine((input) => input.title !== undefined || input.body !== undefined, {
    message: 'provide title, body, or both',
    path: [],
  })
export type UpdatePostInput = z.infer<typeof updatePostSchema>

export interface PostAuthor {
  username: string
  bloogTitle: string
}

export interface PostSummary {
  id: number
  title: string
  /** Rendered and sanitized on the server. The SPA never parses Markdown. */
  bodyHtml: string
  createdAt: string
  updatedAt: string
  author: PostAuthor
}

/** Adds the Markdown source, which only the edit form needs. */
export interface PostDetail extends PostSummary {
  body: string
}

export interface BloogSummary {
  username: string
  bloogTitle: string
  postCount: number
  latestPostAt: string | null
}

export interface BloogWithPosts {
  bloog: BloogSummary
  posts: Page<PostSummary>
}
