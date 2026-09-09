import {
  adminUserPageSchema,
  adminUserSchema,
  bloogSummaryPageSchema,
  bloogSummarySchema,
  bloogWithPostsSchema,
  CSRF_HEADER,
  errorResponseSchema,
  fieldErrorSchema,
  postAuthorSchema,
  postDetailSchema,
  postSummaryPageSchema,
  postSummarySchema,
  publicUserSchema,
  sessionResponseSchema,
} from '@blooger/shared'
import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { StandardSchemaConverter } from '@nestjs/swagger'
import { z } from 'zod'
import { SESSION_COOKIE_NAME } from '../auth/session.constants.js'
import { SESSION_SECURITY_SCHEME } from './decorators.js'

export const DOCS_PATH = 'api/docs'
export const DOCS_JSON_PATH = 'api/docs-json'

/**
 * The response schemas that deserve a name in the document.
 *
 * Without this every response is inlined, so `PostSummary` is spelled out in full
 * in six places and a reader cannot see that they are the same thing.
 */
const NAMED_SCHEMAS: ReadonlyArray<readonly [z.ZodType, string]> = [
  [publicUserSchema, 'PublicUser'],
  [sessionResponseSchema, 'SessionResponse'],
  [postAuthorSchema, 'PostAuthor'],
  [postSummarySchema, 'PostSummary'],
  [postDetailSchema, 'PostDetail'],
  [postSummaryPageSchema, 'PostSummaryPage'],
  [bloogSummarySchema, 'BloogSummary'],
  [bloogSummaryPageSchema, 'BloogSummaryPage'],
  [bloogWithPostsSchema, 'BloogWithPosts'],
  [adminUserSchema, 'AdminUser'],
  [adminUserPageSchema, 'AdminUserPage'],
  [fieldErrorSchema, 'FieldError'],
  [errorResponseSchema, 'ErrorResponse'],
]

/**
 * Converts the named schemas once, cross-referenced.
 *
 * zod resolves the `$ref`s between registry members itself, which is the whole
 * reason for going through a registry rather than converting each schema alone:
 * `PostSummaryPage.items` then points at `PostSummary` instead of repeating it.
 */
function buildComponents(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>()
  for (const [schema, id] of NAMED_SCHEMAS) registry.add(schema, { id })

  const { schemas } = z.toJSONSchema(registry, {
    target: 'openapi-3.0',
    io: 'output',
    uri: (id) => `#/components/schemas/${id}`,
  })

  // `$id` is a JSON Schema keyword that OpenAPI has no use for; zod emits it
  // because that is where it put the URI.
  return Object.fromEntries(
    Object.entries(schemas).map(([id, schema]) => {
      const { $id: _unused, ...rest } = schema as Record<string, unknown>
      return [id, rest]
    }),
  )
}

/**
 * Replaces a named response schema with a reference to its component.
 *
 * Only for responses. Request bodies and query strings arrive here too, and a
 * query schema in particular has to stay inline: the generator decomposes its
 * properties into individual query parameters, which it cannot do through a
 * `$ref`. `schemaType` is how the two are told apart.
 */
function makeConverter(): StandardSchemaConverter {
  const components = buildComponents()
  const names = new Map<unknown, string>(NAMED_SCHEMAS.map(([schema, id]) => [schema, id]))

  return (schema, { schemaType }) => {
    if (schemaType !== 'output') return undefined

    const id = names.get(schema)
    if (!id) return undefined

    return { schema: { $ref: `#/components/schemas/${id}` }, components }
  }
}

const DESCRIPTION = `
The JSON API behind the Blooger SPA.

**Authentication** is a server-side session in a \`${SESSION_COOKIE_NAME}\` cookie,
issued by \`POST /api/sessions\`. It is \`httpOnly\`, so a browser client never
reads it and never needs to: it is sent automatically.

**Every mutating request** (anything but GET, HEAD or OPTIONS) must also carry the
CSRF token from \`GET /api/me\` in a \`${CSRF_HEADER}\` header. A request without it
is rejected with 403, cookie or no cookie.

**Every failure** has the same body, whatever produced it — see the
\`ErrorResponse\` schema. Per-field validation failures add an \`errors\` array.
`.trim()

/**
 * Publishes the OpenAPI document at /api/docs, and the raw JSON at
 * /api/docs-json.
 *
 * There is almost nothing to configure because the request schemas are already
 * declared on the handlers: `@Body({ schema: loginSchema })` both validates and
 * documents. @nestjs/swagger reads zod's Standard Schema interface directly, so
 * no DTO classes and no `@ApiProperty()` anywhere.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Blooger API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0.0')
    .addCookieAuth(
      SESSION_COOKIE_NAME,
      {
        type: 'apiKey',
        in: 'cookie',
        name: SESSION_COOKIE_NAME,
        description: 'Session cookie issued by POST /api/sessions.',
      },
      // The third argument names the *scheme*; without it the scheme is called
      // "cookie" while @ApiCookieAuth points at something else, and the two never
      // meet -- Swagger UI's Authorize button then does nothing on any route.
      SESSION_SECURITY_SCHEME,
    )
    .addTag('auth', 'Registration, login, and the current session')
    .addTag('account', 'The signed-in user’s own record')
    .addTag('posts', 'Reading and writing posts')
    .addTag('bloogs', 'One bloog per user, addressed by username')
    .addTag('admin', 'Administrators only')
    .addTag('health', 'Liveness')
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    standardSchemaConverter: makeConverter(),
  })

  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: DOCS_JSON_PATH,
    swaggerOptions: { persistAuthorization: true },
  })
}
