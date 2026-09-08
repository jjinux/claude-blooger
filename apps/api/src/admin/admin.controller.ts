import {
  type AdminUser,
  type Page,
  type PaginationQuery,
  paginationQuerySchema,
  type PostSummary,
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
import { CurrentUser } from '../auth/current-user.decorator.js'
import { AdminGuard } from '../auth/guards/admin.guard.js'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import type { UserEntity } from '../users/user.entity.js'
import { AdminService } from './admin.service.js'

/** Guard order matters: AuthenticatedGuard is what populates `request.user`. */
@Controller('admin')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  listUsers(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Page<AdminUser>> {
    return this.admin.listUsers(query)
  }

  @Get('posts')
  listPosts(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Page<PostSummary>> {
    return this.admin.listPosts(query)
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: UserEntity,
  ): Promise<void> {
    return this.admin.deleteUser(id, actor)
  }
}
