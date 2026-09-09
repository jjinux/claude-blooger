import {
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
  sessionResponseSchema,
  type SessionResponse,
} from '@blooger/shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { RateLimit } from '../common/rate-limit.guard.js'
import { ApiErrors } from '../docs/decorators.js'
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
@ApiTags('auth')
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
  @ApiOperation({
    summary: 'Who am I, and what CSRF token should I send?',
    description:
      'Answers 200 whether or not anyone is logged in -- `user` is null when nobody is. ' +
      'Always issues a CSRF token, so an anonymous client can call this before registering.',
  })
  @ApiOkResponse({ standardSchema: sessionResponseSchema })
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
  @ApiOperation({
    summary: 'Register, and get a bloog',
    description: 'Logs the new account in, so the response is a session.',
  })
  @ApiCreatedResponse({ standardSchema: sessionResponseSchema })
  @ApiErrors(400, 403, 409, 429)
  async register(
    @Body({ schema: registerSchema }) input: RegisterInput,
    @Req() request: Request,
  ): Promise<SessionResponse> {
    const user = await this.auth.register(input)
    return this.startSession(request, user.id, toPublicUser(user))
  }

  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Log in',
    description:
      'A wrong username and a wrong password fail identically, on purpose: telling ' +
      'them apart would make this endpoint a way to enumerate accounts.',
  })
  @ApiOkResponse({ standardSchema: sessionResponseSchema })
  @ApiErrors(400, 401, 403, 429)
  async login(
    @Body({ schema: loginSchema }) input: LoginInput,
    @Req() request: Request,
  ): Promise<SessionResponse> {
    const user = await this.auth.verifyCredentials(input)
    return this.startSession(request, user.id, toPublicUser(user))
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out' })
  @ApiNoContentResponse({ description: 'Session destroyed.' })
  @ApiErrors(403)
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
