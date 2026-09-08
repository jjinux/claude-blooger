import type { INestApplication } from '@nestjs/common'
import session from 'express-session'
import { DataSource } from 'typeorm'
import { SessionEntity } from './auth/session.entity.js'
import { TypeOrmSessionStore } from './auth/typeorm-session.store.js'
import type { Env } from './config/env.js'

export const SESSION_COOKIE_NAME = 'blooger.sid'

/** Paths served outside the /api prefix. */
export const FEED_ROUTES = [
  'feed.atom',
  'feed.rss',
  'feed.json',
  'bloogs/:username/feed.atom',
  'bloogs/:username/feed.rss',
  'bloogs/:username/feed.json',
]
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Everything that has to happen between `NestFactory.create` and `listen`.
 *
 * Extracted so the integration tests configure their app exactly the way main.ts
 * does -- otherwise the tests would be exercising a subtly different application
 * than the one that ships.
 */
export function configureApp(app: INestApplication, env: Env): void {
  const dataSource = app.get(DataSource)
  const store = new TypeOrmSessionStore(dataSource.getRepository(SessionEntity))

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
}
