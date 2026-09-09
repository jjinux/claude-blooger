import { extname, join, resolve } from 'node:path'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'
import session from 'express-session'
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './auth/session.constants.js'
import { ApiExceptionFilter } from './common/api-exception.filter.js'
import { REPO_ROOT } from './config/paths.js'
import { setupSwagger } from './docs/openapi.js'
import type { Env } from './config/env.js'
import { TypeOrmSessionStore } from './auth/typeorm-session.store.js'

/** Paths served outside the /api prefix. */
export const FEED_ROUTES = [
  'feed.atom',
  'feed.rss',
  'feed.json',
  'bloogs/:username/feed.atom',
  'bloogs/:username/feed.rss',
  'bloogs/:username/feed.json',
]

/**
 * Everything that has to happen between `NestFactory.create` and `listen`.
 *
 * Extracted so the integration tests configure their app exactly the way main.ts
 * does -- otherwise the tests would be exercising a subtly different application
 * than the one that ships.
 */
export function configureApp(app: NestExpressApplication, env: Env): void {
  // First, so that everything below it fails in one documented shape.
  app.useGlobalFilters(new ApiExceptionFilter())

  // From the container, not `new`: SessionSweeper is handed the same instance,
  // and Nest starts and stops it with the application.
  const store = app.get(TypeOrmSessionStore)

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: env.SESSION_SECRET,
      store,
      // The store is only written when something actually changed.
      resave: false,
      // No row for a visitor who never got a session touched.
      saveUninitialized: false,
      // Each request pushes the expiry back, so an active user is not logged out
      // mid-session.
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        // Behind TLS in production; must stay false locally or the cookie is
        // dropped over plain http.
        secure: env.NODE_ENV === 'production',
        maxAge: SESSION_TTL_MS,
        path: '/',
      },
    }),
  )

  // Feeds are not part of the JSON API, and `/feed.atom` is where readers look,
  // so they sit outside the prefix. This list must stay in step with the routes
  // on FeedsController; there is a test that fetches each one.
  app.setGlobalPrefix('api', { exclude: FEED_ROUTES })

  // After the prefix, so the documented paths are the ones clients call.
  setupSwagger(app)

  // In development the SPA is served by Vite, which proxies /api here.
  if (env.NODE_ENV === 'production') serveSpa(app)
}

/**
 * Serves the built SPA, so production is a single origin and a single process.
 *
 * Both handlers are registered before Nest's router, which is what makes the
 * ordering work: `index: false` stops the static handler answering navigations,
 * and the fallback passes anything it should not answer straight through.
 */
function serveSpa(app: NestExpressApplication): void {
  const webDist = resolve(REPO_ROOT, 'apps', 'web', 'dist')

  // Filenames are content-hashed, so they can be cached indefinitely.
  app.useStaticAssets(webDist, { index: false, maxAge: '1y', immutable: true })
  app.use(spaFallback(join(webDist, 'index.html')))
}

function spaFallback(indexHtml: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return next()

    // The JSON API answers for itself, including its 404s.
    if (request.path.startsWith('/api/')) return next()

    // Anything with an extension is either a real asset that the static handler
    // already declined, or a feed -- `/bloogs/joe/feed.atom` must not be handed
    // an HTML page. A client-side route such as `/bloogs/joe` has no extension.
    if (extname(request.path) !== '') return next()

    // An API client that asked for JSON should get a JSON 404, not a page.
    if (!request.accepts('html')) return next()

    response.sendFile(indexHtml)
  }
}

/**
 * Registered *after* `app.init()`, which is what makes it work: Express runs
 * middleware in registration order, and Nest's router calls `next()` when nothing
 * matches. Anything added inside `configureApp` runs before the router and so
 * cannot tell a miss from a hit.
 *
 * Without this, an unmatched /api path falls through to Express's default
 * handler, which answers with an HTML page -- a JSON client then has to parse
 * markup to discover it got a 404.
 */
export function registerApiNotFound(app: NestExpressApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .use((request: Request, response: Response, next: NextFunction) => {
      if (!request.path.startsWith('/api/')) return next()

      response.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: `Cannot ${request.method} ${request.path}`,
      })
    })
}
