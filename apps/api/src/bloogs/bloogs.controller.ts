import {
  type BloogSummary,
  bloogSummaryPageSchema,
  type BloogWithPosts,
  bloogWithPostsSchema,
  type Page,
  type PaginationQuery,
  paginationQuerySchema,
} from '@blooger/shared'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../docs/decorators.js'
import { BloogsService } from './bloogs.service.js'

@ApiTags('bloogs')
@Controller('bloogs')
export class BloogsController {
  constructor(private readonly bloogs: BloogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Every bloog',
    description:
      'Post counts and latest-post timestamps for the whole page come from one grouped ' +
      'query, not one count per user.',
  })
  @ApiOkResponse({ standardSchema: bloogSummaryPageSchema })
  @ApiErrors(400)
  list(
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<Page<BloogSummary>> {
    return this.bloogs.list(query)
  }

  /** Bloogs are addressed by username, as they were in the Rails app. */
  @Get(':username')
  @ApiOperation({ summary: 'One bloog, and a page of its posts' })
  @ApiOkResponse({ standardSchema: bloogWithPostsSchema })
  @ApiErrors(400, 404)
  findOne(
    @Param('username') username: string,
    @Query({ schema: paginationQuerySchema }) query: PaginationQuery,
  ): Promise<BloogWithPosts> {
    return this.bloogs.findByUsername(username, query)
  }
}
