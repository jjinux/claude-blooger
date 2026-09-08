import 'express-session'
import type { UserEntity } from '../users/user.entity.js'

declare module 'express-session' {
  interface SessionData {
    /** Set on login, cleared on logout. Absence means anonymous. */
    userId?: number
    /** Synchronizer token echoed back in the x-csrf-token header. */
    csrfToken?: string
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by AuthenticatedGuard; undefined on unauthenticated routes. */
      user?: UserEntity
    }
  }
}

export {}
