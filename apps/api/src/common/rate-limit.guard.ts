import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

const RATE_LIMIT_KEY = 'blooger:rate-limit'

/** Applies a fixed-window rate limit to one route. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options)

interface Window {
  count: number
  resetAt: number
}

/**
 * Small in-process fixed-window limiter, applied only to the routes that ask for
 * it via @RateLimit.
 *
 * Written in-house rather than using @nestjs/throttler, whose current release
 * (6.5.0) declares peer support only up to @nestjs/common ^11 and so refuses to
 * install against Nest 12. Because the counters live in this process's memory,
 * the limit is per-instance: running more than one API process would multiply the
 * effective limit, and a restart clears it. That is an acceptable trade for
 * slowing down password guessing on a single-instance app; swap in a shared store
 * before running several replicas.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>()

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!options) return true

    const request = context.switchToHttp().getRequest<Request>()
    const key = `${context.getClass().name}.${context.getHandler().name}:${request.ip ?? 'unknown'}`
    const now = Date.now()

    this.evictExpired(now)

    const window = this.windows.get(key)
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + options.windowMs })
      return true
    }

    window.count += 1
    if (window.count > options.limit) {
      throw new HttpException(
        {
          message: 'Too many attempts. Try again shortly.',
          retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    return true
  }

  /** Clears all counters. Used by tests so one spec's traffic cannot fail the next. */
  reset(): void {
    this.windows.clear()
  }

  /** Keeps the map from growing without bound across many distinct client IPs. */
  private evictExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key)
    }
  }
}
