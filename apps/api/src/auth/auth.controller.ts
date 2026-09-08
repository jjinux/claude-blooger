import {
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
  type SessionResponse,
} from '@blooger/shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { RateLimit } from '../common/rate-limit.guard.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { toPublicUser, UsersService } from '../users/users.service.js'
import { AuthService } from './auth.service.js'
import {
  ensureCsrfToken,
  destroySession,
  newCsrfToken,
  regenerateSession,
  saveSession,
} from './session.helpers.js'

// RateLimitGuard is registered globally in AppModule, so listing it in
// @UseGuards here as well would run it twice per request -- double-counting every
// attempt against the limit.
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /**
   * The SPA's bootstrap call: reports who you are and issues the CSRF token that
   * every later mutating request has to echo back.
   */
  @Get('me')
  async me(@Req() request: Request): Promise<SessionResponse> {
    const csrfToken = ensureCsrfToken(request)
    const userId = request.session.userId

    if (userId === undefined) return { user: null, csrfToken }

    const user = await this.users.findById(userId)
    return { user: user ? toPublicUser(user) : null, csrfToken }
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 5, windowMs: 60_000 })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
    @Req() request: Request,
  ): Promise<SessionResponse> {
    const user = await this.auth.register(input)
    return this.startSession(request, user.id, toPublicUser(user))
  }

  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Req() request: Request,
  ): Promise<SessionResponse> {
    const user = await this.auth.verifyCredentials(input)
    return this.startSession(request, user.id, toPublicUser(user))
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request): Promise<void> {
    await destroySession(request)
  }

  /**
   * Regenerating issues a brand-new session id, which is what defeats session
   * fixation: a token an attacker planted before login is discarded rather than
   * being upgraded to an authenticated one.
   */
  private async startSession(
    request: Request,
    userId: number,
    user: SessionResponse['user'],
  ): Promise<SessionResponse> {
    await regenerateSession(request)

    request.session.userId = userId
    const csrfToken = newCsrfToken()
    request.session.csrfToken = csrfToken

    await saveSession(request)

    return { user, csrfToken }
  }
}
