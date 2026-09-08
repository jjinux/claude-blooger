import { z } from 'zod'
import { POST_BODY_MAX_LENGTH, POST_TITLE_MAX_LENGTH } from './constants.js'

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
