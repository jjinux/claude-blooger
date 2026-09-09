import {
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { TypeOrmSessionStore } from './typeorm-session.store.js'

export const SWEEP_MIN_MS = 20 * 60 * 1000
export const SWEEP_MAX_MS = 60 * 60 * 1000

/**
 * Deletes expired session rows, forever, on a jittered timer.
 *
 * Expiry is already enforced on every read, so a stale row can never
 * authenticate anybody; this is about the table not growing without bound as
 * every visitor who ever loaded a page leaves a row behind.
 *
 * **The delay is re-randomised before every sweep, not just the first.** That is
 * the whole design. Two processes started together drift apart immediately and
 * stay uncorrelated, and a fleet restarted at once does not resynchronise into a
 * thundering herd -- which a fixed `setInterval` would guarantee.
 *
 * There is no lock, and none is wanted. `DELETE ... WHERE expires_at < NOW()` is
 * idempotent: a second replica running it a moment later deletes the rows the
 * first one missed, or none at all. Duplicated work on a table this size is far
 * cheaper than a lock to coordinate it, and unlike an external scheduler it needs
 * nothing deployed alongside the app.
 */
@Injectable()
export class SessionSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SessionSweeper.name)
  private timer: NodeJS.Timeout | undefined
  private stopped = false

  constructor(
    private readonly store: TypeOrmSessionStore,
    /**
     * Only so the test can make the schedule predictable. `@Optional()` because
     * Nest would otherwise try to resolve `Function` from the container and fail
     * to start; it passes undefined instead, and the default takes over.
     */
    @Optional() private readonly random: () => number = Math.random,
  ) {}

  onApplicationBootstrap(): void {
    this.start()
  }

  onApplicationShutdown(): void {
    this.stop()
  }

  start(): void {
    this.stopped = false
    this.scheduleNext()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }

  /** A uniform delay in [20, 60] minutes. */
  nextDelayMs(): number {
    return SWEEP_MIN_MS + this.random() * (SWEEP_MAX_MS - SWEEP_MIN_MS)
  }

  private scheduleNext(): void {
    if (this.stopped) return

    this.timer = setTimeout(() => void this.sweep(), this.nextDelayMs())
    // Housekeeping must never be the reason a process stays alive -- and in the
    // test suite, a referenced timer would hold the whole run open.
    this.timer.unref()
  }

  private async sweep(): Promise<void> {
    try {
      const deleted = await this.store.pruneExpired()
      if (deleted > 0) this.logger.log(`Swept ${deleted} expired session(s).`)
    } catch (error) {
      // A failed sweep is not worth taking the process down for; the next one is
      // less than an hour away, and expiry is enforced on read regardless.
      this.logger.error('Session sweep failed.', error instanceof Error ? error.stack : error)
    } finally {
      this.scheduleNext()
    }
  }
}
