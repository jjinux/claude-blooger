/**
 * The zod-free half of this package: constants and wire types, nothing else.
 *
 * The SPA imports from `@blooger/shared/contracts` rather than the package root.
 * Importing the root instead costs ~890 kB of zod source in the browser bundle,
 * because the schemas are top-level `z.object(...)` calls evaluated at module
 * load, which a bundler cannot prove are side-effect free and therefore cannot
 * drop. The API imports the root and gets both halves.
 */
export * from './constants.js'
export * from './types.js'

/**
 * The request types inferred from the zod schemas.
 *
 * `export type` is erased entirely, so these names cost the browser nothing --
 * the emitted contracts.js contains no reference to the schema modules at all.
 * Deriving them from the schemas rather than restating them here is what keeps
 * the SPA's forms and the API's validation from drifting apart.
 */
export type { LoginInput, RegisterInput, UpdateAccountInput } from './auth.js'
export type { PaginationQuery } from './pagination.js'
export type { CreatePostInput, UpdatePostInput } from './posts.js'
