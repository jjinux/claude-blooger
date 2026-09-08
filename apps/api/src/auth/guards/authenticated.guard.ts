import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { UsersService } from '../../users/users.service.js'
import { destroySession } from '../session.helpers.js'

/**
 * Requires a logged-in user and attaches the entity to `request.user`.
 *
 * The user is re-read on every request rather than trusted from the session
 * payload, so a deleted or demoted account loses access immediately instead of
 * whenever its session happens to expire.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const userId = request.session?.userId

    if (userId === undefined) throw new UnauthorizedException('You must be logged in')

    const user = await this.users.findById(userId)
    if (!user) {
      // The account was deleted while the session was still live.
      await destroySession(request)
      throw new UnauthorizedException('You must be logged in')
    }

    request.user = user
    return true
  }
}
