import { z } from 'zod'

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50

/** Query string for any paginated listing. Coerces because query params are strings. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

/** Envelope returned by every paginated endpoint. */
export interface Page<T> {
  items: T[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

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
