import { Store, type SessionData } from 'express-session'
import { LessThan, type Repository } from 'typeorm'
import type { SessionEntity } from './session.entity.js'

/** Falls back to a day if a session somehow arrives with no cookie expiry. */
const FALLBACK_TTL_MS = 24 * 60 * 60 * 1000

function expiresAtFor(session: SessionData): Date {
  const expires = session.cookie?.expires
  if (expires) return new Date(expires)

  const maxAge = session.cookie?.maxAge
  return new Date(Date.now() + (maxAge ?? FALLBACK_TTL_MS))
}

/**
 * express-session store backed by TypeORM.
 *
 * Written by hand because `connect-typeorm`, the obvious dependency, was last
 * published in 2022 and declares `typeorm ^0.3.0` as a peer, so it will not
 * install against TypeORM 1.x.
 *
 * `userId` is denormalised out of the session payload into its own column so that
 * revoking every session for a user is a single indexed DELETE rather than a scan
 * that has to JSON-parse every row.
 */
export class TypeOrmSessionStore extends Store {
  constructor(private readonly sessions: Repository<SessionEntity>) {
    super()
  }

  get(sid: string, callback: (error: unknown, session?: SessionData | null) => void): void {
    this.loadSession(sid).then(
      (session) => callback(null, session),
      (error: unknown) => callback(error),
    )
  }

  set(sid: string, session: SessionData, callback?: (error?: unknown) => void): void {
    this.sessions
      .upsert(
        {
          id: sid,
          userId: session.userId ?? null,
          expiresAt: expiresAtFor(session),
          data: JSON.stringify(session),
        },
        ['id'],
      )
      .then(
        () => callback?.(),
        (error: unknown) => callback?.(error),
      )
  }

  destroy(sid: string, callback?: (error?: unknown) => void): void {
    this.sessions.delete({ id: sid }).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    )
  }

  /** Extends the expiry of an active session without rewriting its payload. */
  override touch(sid: string, session: SessionData, callback?: (error?: unknown) => void): void {
    this.sessions.update({ id: sid }, { expiresAt: expiresAtFor(session) }).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    )
  }

  override length(callback: (error: unknown, length?: number) => void): void {
    this.sessions.count().then(
      (count) => callback(null, count),
      (error: unknown) => callback(error),
    )
  }

  override clear(callback?: (error?: unknown) => void): void {
    this.sessions
      .createQueryBuilder()
      .delete()
      .execute()
      .then(
        () => callback?.(),
        (error: unknown) => callback?.(error),
      )
  }

  /** Deletes every expired row. Call periodically; expiry is also enforced on read. */
  async pruneExpired(): Promise<number> {
    const result = await this.sessions.delete({ expiresAt: LessThan(new Date()) })
    return result.affected ?? 0
  }

  private async loadSession(sid: string): Promise<SessionData | null> {
    const row = await this.sessions.findOne({
      where: { id: sid },
      loadEagerRelations: false,
    })

    if (!row) return null

    // Expiry is enforced here as well as by pruning, so a stale row can never
    // authenticate a request even if the sweep has not run.
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.sessions.delete({ id: sid })
      return null
    }

    return JSON.parse(row.data) as SessionData
  }
}
