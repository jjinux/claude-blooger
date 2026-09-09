import { z } from 'zod'

/** One field's validation failure, so a form can render it beside its input. */
export const fieldErrorSchema = z.object({
  field: z.string().describe('Dotted path to the offending field, or "(root)".'),
  message: z.string(),
})

/**
 * The shape of every failure the API emits, without exception.
 *
 * Nest's own error bodies vary with how the exception was constructed -- a string
 * argument yields `{ statusCode, error, message }`, an object argument replaces
 * that wholesale -- so this is normalized by an exception filter rather than left
 * to each throw site. It lives here because the SPA parses it.
 */
export const errorResponseSchema = z.object({
  statusCode: z.int(),
  error: z.string().describe('The HTTP reason phrase, e.g. "Bad Request".'),
  message: z.string(),
  errors: z
    .array(fieldErrorSchema)
    .optional()
    .describe('Present only when the failure was per-field validation.'),
})

export type FieldError = z.infer<typeof fieldErrorSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
