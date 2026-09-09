import { buildPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, paginationQuerySchema } from '@blooger/shared'
import { describe, expect, it } from 'vitest'

/**
 * `buildPage` and `paginationQuerySchema` live in `packages/shared`, which has no
 * test suite of its own -- it is types, schemas, and this one piece of
 * arithmetic. The tests live here, in the only workspace that calls them at
 * runtime and the only one CI already runs. Give the shared package its own
 * suite when it grows a second piece of logic worth testing.
 */
describe('pagination', () => {
  const query = (page: number, perPage: number) => ({ page, perPage })

  describe('buildPage', () => {
    it('reports a single empty page when there is nothing at all', () => {
      // Not zero pages: "page 1 of 0" is nonsense to render, and every caller
      // would have to special-case it.
      expect(buildPage([], 0, query(1, 10))).toEqual({
        items: [],
        page: 1,
        perPage: 10,
        totalItems: 0,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      })
    })

    it('rounds a partial last page up', () => {
      expect(buildPage([], 21, query(1, 10)).totalPages).toBe(3)
      expect(buildPage([], 19, query(1, 10)).totalPages).toBe(2)
      expect(buildPage([], 1, query(1, 10)).totalPages).toBe(1)
    })

    /** The off-by-one that pagination always gets wrong. */
    it('does not invent a page when the count divides exactly', () => {
      const page = buildPage([], 20, query(2, 10))

      expect(page.totalPages).toBe(2)
      expect(page.hasNext).toBe(false)
      expect(page.hasPrevious).toBe(true)
    })

    it.each([
      [1, 3, false, true],
      [2, 3, true, true],
      [3, 3, true, false],
    ])('page %i of %i: previous=%s next=%s', (page, _total, hasPrevious, hasNext) => {
      const built = buildPage([], 30, query(page, 10))

      expect(built.hasPrevious).toBe(hasPrevious)
      expect(built.hasNext).toBe(hasNext)
    })

    it('reports no next page when asked for one past the end', () => {
      const page = buildPage([], 5, query(99, 10))

      expect(page.totalPages).toBe(1)
      expect(page.hasNext).toBe(false)
      expect(page.hasPrevious).toBe(true)
    })

    it('echoes the query rather than the length of what it was handed', () => {
      // The items are one page of a larger set; `totalItems` is the whole set.
      const page = buildPage(['a', 'b'], 57, query(3, 2))

      expect(page.items).toEqual(['a', 'b'])
      expect(page.totalItems).toBe(57)
      expect(page.perPage).toBe(2)
      expect(page.page).toBe(3)
    })
  })

  describe('paginationQuerySchema', () => {
    it('defaults an absent query', () => {
      expect(paginationQuerySchema.parse({})).toEqual({
        page: 1,
        perPage: DEFAULT_PAGE_SIZE,
      })
    })

    it('coerces the strings a query string actually delivers', () => {
      expect(paginationQuerySchema.parse({ page: '3', perPage: '25' })).toEqual({
        page: 3,
        perPage: 25,
      })
    })

    it.each([
      ['page zero', { page: '0' }],
      ['a negative page', { page: '-1' }],
      ['a fractional page', { page: '1.5' }],
      ['perPage zero', { perPage: '0' }],
      ['perPage over the cap', { perPage: String(MAX_PAGE_SIZE + 1) }],
      ['nonsense', { page: 'banana' }],
    ])('rejects %s', (_name, input) => {
      expect(paginationQuerySchema.safeParse(input).success).toBe(false)
    })

    it('caps perPage so a client cannot ask for the whole table', () => {
      expect(paginationQuerySchema.parse({ perPage: String(MAX_PAGE_SIZE) }).perPage).toBe(
        MAX_PAGE_SIZE,
      )
    })
  })
})
