import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './harness.js'

interface OpenApiDocument {
  openapi: string
  paths: Record<string, Record<string, Operation>>
  components: {
    schemas: Record<string, unknown>
    securitySchemes: Record<string, unknown>
  }
}

interface Operation {
  summary?: string
  security?: Record<string, unknown>[]
  responses: Record<string, unknown>
}

/**
 * Every operation the API publishes, spelled out.
 *
 * A list rather than something derived from the router on purpose: adding an
 * endpoint should be a deliberate edit here, which is the moment to notice it
 * needs documenting.
 */
const EXPECTED_OPERATIONS = [
  'DELETE /api/admin/users/{id}',
  'DELETE /api/posts/{id}',
  'DELETE /api/sessions',
  'GET /api/account',
  'GET /api/admin/posts',
  'GET /api/admin/users',
  'GET /api/bloogs',
  'GET /api/bloogs/{username}',
  'GET /api/health',
  'GET /api/me',
  'GET /api/posts',
  'GET /api/posts/{id}',
  'GET /bloogs/{username}/feed.atom',
  'GET /bloogs/{username}/feed.json',
  'GET /bloogs/{username}/feed.rss',
  'GET /feed.atom',
  'GET /feed.json',
  'GET /feed.rss',
  'PATCH /api/account',
  'PATCH /api/posts/{id}',
  'POST /api/posts',
  'POST /api/sessions',
  'POST /api/users',
]

/** Every `$ref` anywhere in the document, however deeply nested. */
function collectRefs(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, found)
    return found
  }
  if (typeof value !== 'object' || value === null) return found

  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') found.push(child)
    else collectRefs(child, found)
  }
  return found
}

describe('the OpenAPI document', () => {
  let ctx: TestApp
  let document: OpenApiDocument
  let operations: [string, Operation][]

  beforeAll(async () => {
    ctx = await createTestApp()

    const response = await ctx.agent.get('/api/docs-json').expect(200)
    document = response.body as OpenApiDocument

    operations = Object.entries(document.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]): [string, Operation] => [
        `${method.toUpperCase()} ${path}`,
        operation,
      ]),
    )
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('serves the UI', async () => {
    const response = await ctx.agent.get('/api/docs').expect(200)
    expect(response.headers['content-type']).toContain('text/html')
  })

  it('documents every endpoint, under the /api prefix the clients actually call', () => {
    expect(operations.map(([name]) => name).sort()).toEqual(EXPECTED_OPERATIONS)
  })

  it('gives every operation a summary', () => {
    const missing = operations.filter(([, operation]) => !operation.summary).map(([name]) => name)
    expect(missing).toEqual([])
  })

  /**
   * The bug this exists for: `addCookieAuth`'s first argument names the *cookie*,
   * and its third names the *scheme*. Getting them confused produces a document
   * whose protected routes require a scheme that was never defined, and Swagger
   * UI's Authorize button then silently does nothing.
   */
  it('resolves every security requirement to a declared scheme', () => {
    const declared = Object.keys(document.components.securitySchemes)
    const required = operations.flatMap(([, operation]) =>
      (operation.security ?? []).flatMap((entry) => Object.keys(entry)),
    )

    expect(required.length).toBeGreaterThan(0)
    expect([...new Set(required)].filter((name) => !declared.includes(name))).toEqual([])
  })

  it('resolves every $ref to a component that exists', () => {
    const names = Object.keys(document.components.schemas)
    const dangling = [...new Set(collectRefs(document))].filter(
      (ref) => !names.includes(ref.replace('#/components/schemas/', '')),
    )

    expect(dangling).toEqual([])
  })

  it('names the response models rather than inlining them everywhere', () => {
    expect(Object.keys(document.components.schemas).sort()).toContain('PostSummary')

    const listPosts = document.paths['/api/posts']?.get
    expect(listPosts?.responses['200']).toMatchObject({
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/PostSummaryPage' } },
      },
    })
  })

  it('describes every documented failure with the one error shape', () => {
    const failures = operations.flatMap(([name, operation]) =>
      Object.entries(operation.responses)
        .filter(([status]) => Number(status) >= 400)
        .map(([status, response]) => [`${name} ${status}`, response] as const),
    )

    expect(failures.length).toBeGreaterThan(0)
    for (const [where, response] of failures) {
      expect(response, where).toMatchObject({
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      })
    }
  })

  it('derives request bodies from the same schemas that validate them', () => {
    expect(document.paths['/api/sessions']?.post).toMatchObject({
      requestBody: {
        content: {
          'application/json': {
            schema: { required: ['username', 'password'] },
          },
        },
      },
    })
  })
})
