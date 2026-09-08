import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants.js'
import type { Page } from './types.js'

/** Query string for any paginated listing. Coerces because query params are strings. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export function buildPage<T>(items: T[], totalItems: number, query: PaginationQuery): Page<T> {
  const totalPages = Math.max(1, Math.ceil(totalItems / query.perPage))

  return {
    items,
    page: query.page,
    perPage: query.perPage,
    totalItems,
    totalPages,
    hasPrevious: query.page > 1,
    hasNext: query.page < totalPages,
  }
}
