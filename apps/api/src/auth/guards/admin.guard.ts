import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { Request } from 'express'

/**
 * Requires the current user to be an admin. Must run after AuthenticatedGuard,
 * which is what populates `request.user` -- list them in that order in @UseGuards.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()

    if (!request.user?.isAdmin) {
      throw new ForbiddenException('Admin access required')
    }

    return true
  }
}
