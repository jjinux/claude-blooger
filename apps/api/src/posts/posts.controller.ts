import {
  createPostSchema,
  type CreatePostInput,
  type Page,
  type PaginationQuery,
  paginationQuerySchema,
  type PostDetail,
  type PostSummary,
  updatePostSchema,
  type UpdatePostInput,
} from '@blooger/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator.js'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import type { UserEntity } from '../users/user.entity.js'
import { PostsService } from './posts.service.js'

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  /** Recent posts across every bloog. This is what the homepage renders. */
  @Get()
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Page<PostSummary>> {
    return this.posts.listRecent(query)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PostDetail> {
    return this.posts.findDetail(id)
  }

  @Post()
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: UserEntity,
    @Body(new ZodValidationPipe(createPostSchema)) input: CreatePostInput,
  ): Promise<PostDetail> {
    return this.posts.create(user, input)
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserEntity,
    @Body(new ZodValidationPipe(updatePostSchema)) input: UpdatePostInput,
  ): Promise<PostDetail> {
    return this.posts.update(id, user, input)
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserEntity): Promise<void> {
    return this.posts.remove(id, user)
  }
}
