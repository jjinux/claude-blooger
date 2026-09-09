import {
  type AdminUser,
  adminUserPageSchema,
  type Page,
  type PaginationQuery,
  paginationQuerySchema,
  type PostSummary,
  postSummaryPageSchema,
} from '@blooger/shared'
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator.js'
import { ApiErrors, ApiSession } from '../docs/decorators.js'
import { AdminGuard } from '../auth/guards/admin.guard.js'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard.js'
import type { UserEntity } from '../users/user.entity.js'
import { AdminService } from './admin.service.js'

/** Guard order matters: AuthenticatedGuard is what populates `request.user`. */
@ApiTags('admin')
@ApiSession()
@Controller('admin')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Every account, with its post count' })
  @ApiOkResponse({ standardSchema: adminUserPageSchema })
  @ApiErrors(400, 401, 403)
  listUsers(
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Page<AdminUser>> {
    return this.admin.listUsers(query)
  }

  @Get('posts')
  @ApiOperation({ summary: 'Every post, newest first' })
  @ApiOkResponse({ standardSchema: postSummaryPageSchema })
  @ApiErrors(400, 401, 403)
  listPosts(
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Page<PostSummary>> {
    return this.admin.listPosts(query)
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an account and everything it wrote',
    description: 'Posts and sessions go with it, by ON DELETE CASCADE. You cannot delete yourself.',
  })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrors(401, 403, 404)
  deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: UserEntity,
  ): Promise<void> {
    return this.admin.deleteUser(id, actor)
  }
}
