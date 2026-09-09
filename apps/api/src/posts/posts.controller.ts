import {
  createPostSchema,
  type CreatePostInput,
  type Page,
  type PaginationQuery,
  paginationQuerySchema,
  type PostDetail,
  postDetailSchema,
  type PostSummary,
  postSummaryPageSchema,
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
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator.js'
import { ApiErrors, ApiSession } from '../docs/decorators.js'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard.js'
import type { UserEntity } from '../users/user.entity.js'
import { PostsService } from './posts.service.js'

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  /** Recent posts across every bloog. This is what the homepage renders. */
  @Get()
  @ApiOperation({
    summary: 'Recent posts from every bloog',
    description: 'Newest first, tie-broken by id so paging cannot repeat or skip a row.',
  })
  @ApiOkResponse({ standardSchema: postSummaryPageSchema })
  @ApiErrors(400)
  list(
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Page<PostSummary>> {
    return this.posts.listRecent(query)
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One post',
    description: 'Carries `body` as well as `bodyHtml`; the edit form needs the Markdown.',
  })
  @ApiOkResponse({ standardSchema: postDetailSchema })
  @ApiErrors(404)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PostDetail> {
    return this.posts.findDetail(id)
  }

  @Post()
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiSession()
  @ApiOperation({
    summary: 'Publish a post',
    description: 'The body is Markdown. It is rendered and sanitized here, never in the browser.',
  })
  @ApiCreatedResponse({ standardSchema: postDetailSchema })
  @ApiErrors(400, 401, 403)
  create(
    @CurrentUser() user: UserEntity,
    @Body({ schema: createPostSchema }) input: CreatePostInput,
  ): Promise<PostDetail> {
    return this.posts.create(user, input)
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  @ApiSession()
  @ApiOperation({ summary: 'Edit a post', description: 'Authors only, plus administrators.' })
  @ApiOkResponse({ standardSchema: postDetailSchema })
  @ApiErrors(400, 401, 403, 404)
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserEntity,
    @Body({ schema: updatePostSchema }) input: UpdatePostInput,
  ): Promise<PostDetail> {
    return this.posts.update(id, user, input)
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiSession()
  @ApiOperation({ summary: 'Delete a post', description: 'Authors only, plus administrators.' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrors(401, 403, 404)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserEntity): Promise<void> {
    return this.posts.remove(id, user)
  }
}
