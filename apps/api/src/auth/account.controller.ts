import { type PublicUser, type UpdateAccountInput, updateAccountSchema } from '@blooger/shared'
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { toPublicUser } from '../users/users.service.js'
import type { UserEntity } from '../users/user.entity.js'
import { AuthService } from './auth.service.js'
import { CurrentUser } from './current-user.decorator.js'
import { AuthenticatedGuard } from './guards/authenticated.guard.js'

@Controller('account')
@UseGuards(AuthenticatedGuard)
export class AccountController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  get(@CurrentUser() user: UserEntity): PublicUser {
    return toPublicUser(user)
  }

  @Patch()
  async update(
    @CurrentUser() user: UserEntity,
    @Body(new ZodValidationPipe(updateAccountSchema)) input: UpdateAccountInput,
  ): Promise<PublicUser> {
    return toPublicUser(await this.auth.updateAccount(user, input))
  }
}
