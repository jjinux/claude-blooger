/**
 * Plain values with no dependencies.
 *
 * Deliberately free of any import of zod: the SPA needs these numbers and header
 * names, and if they lived alongside the schemas then importing one constant
 * would drag the whole validation library into the browser bundle. See
 * `contracts.ts`.
 */

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 64
export const PASSWORD_MIN_LENGTH = 8
/**
 * argon2 hashes the whole input, so an unbounded password is a cheap way to burn
 * server CPU. The cap is generous enough never to inconvenience a real passphrase.
 */
export const PASSWORD_MAX_LENGTH = 200
export const BLOOG_TITLE_MAX_LENGTH = 128

export const POST_TITLE_MAX_LENGTH = 255
/** Generous, but bounded: `body` is a MySQL TEXT column (65,535 bytes). */
export const POST_BODY_MAX_LENGTH = 60_000

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50

export const CSRF_HEADER = 'x-csrf-token'
