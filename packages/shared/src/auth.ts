import { z } from 'zod'

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 64
export const PASSWORD_MIN_LENGTH = 8
/**
 * argon2 hashes the whole input, so an unbounded password is a cheap way to burn
 * server CPU. The cap is generous enough never to inconvenience a real passphrase.
 */
export const PASSWORD_MAX_LENGTH = 200
export const BLOOG_TITLE_MAX_LENGTH = 128

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
 * Deliberately lax compared to `registerSchema`: rejecting a login for failing
 * the *registration* rules would tell an attacker which usernames are well-formed
 * enough to exist, and would lock out any account created under older rules.
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

/** A user as the API is willing to expose it. Never carries the password hash. */
export interface PublicUser {
  id: number
  username: string
  bloogTitle: string
  isAdmin: boolean
  createdAt: string
}

/**
 * Returned by GET /api/me. The SPA calls it on boot to learn who it is and to
 * pick up the CSRF token it must echo on every mutating request.
 */
export interface SessionResponse {
  user: PublicUser | null
  csrfToken: string
}

export const CSRF_HEADER = 'x-csrf-token'
