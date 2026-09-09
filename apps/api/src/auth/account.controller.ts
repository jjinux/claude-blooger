import {
  publicUserSchema,
  type PublicUser,
  type UpdateAccountInput,
  updateAccountSchema,
} from '@blooger/shared'
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors, ApiSession } from '../docs/decorators.js'
import { toPublicUser } from '../users/users.service.js'
import type { UserEntity } from '../users/user.entity.js'
import { AuthService } from './auth.service.js'
import { CurrentUser } from './current-user.decorator.js'
import { AuthenticatedGuard } from './guards/authenticated.guard.js'

@ApiTags('account')
@ApiSession()
@Controller('account')
@UseGuards(AuthenticatedGuard)
export class AccountController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'Read my own account' })
  @ApiOkResponse({ standardSchema: publicUserSchema })
  @ApiErrors(401)
  get(@CurrentUser() user: UserEntity): PublicUser {
    return toPublicUser(user)
  }

  @Patch()
  @ApiOperation({
    summary: 'Change my bloog title, or my password',
    description: 'Changing the password requires `currentPassword`.',
  })
  @ApiOkResponse({ standardSchema: publicUserSchema })
  @ApiErrors(400, 401, 403)
  async update(
    @CurrentUser() user: UserEntity,
    @Body({ schema: updateAccountSchema }) input: UpdateAccountInput,
  ): Promise<PublicUser> {
    return toPublicUser(await this.auth.updateAccount(user, input))
  }
}
