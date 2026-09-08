/** Wire shapes shared by the API and the SPA. Types only -- erased at build time. */

/** A user as the API is willing to expose it. Never carries the password hash. */
export interface PublicUser {
  id: number
  username: string
  bloogTitle: string
  isAdmin: boolean
  createdAt: string
}

/**
 * Returned by GET /api/me. The SPA calls it on boot to learn who it is and to
 * pick up the CSRF token it must echo on every mutating request.
 */
export interface SessionResponse {
  user: PublicUser | null
  csrfToken: string
}

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

export interface PostAuthor {
  username: string
  bloogTitle: string
}

export interface PostSummary {
  id: number
  title: string
  /** Rendered and sanitized on the server. The SPA never parses Markdown. */
  bodyHtml: string
  createdAt: string
  updatedAt: string
  author: PostAuthor
}

/** Adds the Markdown source, which only the edit form needs. */
export interface PostDetail extends PostSummary {
  body: string
}

export interface BloogSummary {
  username: string
  bloogTitle: string
  postCount: number
  latestPostAt: string | null
}

export interface BloogWithPosts {
  bloog: BloogSummary
  posts: Page<PostSummary>
}

/** A user as the /admin section sees them: adds the id, role, and post count. */
export interface AdminUser {
  id: number
  username: string
  bloogTitle: string
  isAdmin: boolean
  createdAt: string
  postCount: number
}
