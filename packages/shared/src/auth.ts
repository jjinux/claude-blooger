import { z } from 'zod'
import {
  BLOOG_TITLE_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from './constants.js'

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/, 'may contain only letters, digits, underscores and hyphens')

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

export const bloogTitleSchema = z.string().trim().min(1).max(BLOOG_TITLE_MAX_LENGTH)

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  bloogTitle: bloogTitleSchema,
})
export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Deliberately lax compared to `registerSchema`: rejecting a login for breaking
 * the current registration rules would leak which usernames are well-formed
 * enough to exist, and would lock out accounts created under older rules.
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(USERNAME_MAX_LENGTH),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})
export type LoginInput = z.infer<typeof loginSchema>

export const updateAccountSchema = z
  .object({
    bloogTitle: bloogTitleSchema.optional(),
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine((input) => input.newPassword === undefined || input.currentPassword !== undefined, {
    message: 'currentPassword is required when setting a new password',
    path: ['currentPassword'],
  })
  .refine((input) => input.bloogTitle !== undefined || input.newPassword !== undefined, {
    message: 'provide bloogTitle, newPassword, or both',
    path: [],
  })
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
