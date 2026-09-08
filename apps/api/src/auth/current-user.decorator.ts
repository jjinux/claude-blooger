import { createParamDecorator, type ExecutionContext, InternalServerErrorException } from '@nestjs/common'
import type { Request } from 'express'
import type { UserEntity } from '../users/user.entity.js'

/**
 * Injects the logged-in user. Only valid on routes behind AuthenticatedGuard;
 * throwing rather than returning undefined turns a forgotten guard into an
 * obvious 500 during development instead of a null-dereference later.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserEntity => {
    const request = context.switchToHttp().getRequest<Request>()

    if (!request.user) {
      throw new InternalServerErrorException(
        '@CurrentUser() used on a route that is not behind AuthenticatedGuard',
      )
    }

    return request.user
  },
)
