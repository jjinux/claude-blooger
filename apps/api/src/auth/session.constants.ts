/**
 * Session facts that more than one module needs to state.
 *
 * They live here rather than in bootstrap.ts because the OpenAPI description
 * names the cookie, and bootstrap.ts imports the OpenAPI setup: an import back
 * the other way is a cycle, and under ESM that is not a warning. The description
 * is a top-level template literal, so it evaluates while bootstrap.ts is still
 * initializing and fails with "Cannot access 'SESSION_COOKIE_NAME' before
 * initialization" -- the same shape of failure that `Relation<T>` exists to
 * prevent between the entities.
 */
export const SESSION_COOKIE_NAME = 'blooger.sid'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
