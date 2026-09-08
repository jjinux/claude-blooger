import {
  type BloogSummary,
  type BloogWithPosts,
  type Page,
  type PaginationQuery,
  paginationQuerySchema,
} from '@blooger/shared'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { BloogsService } from './bloogs.service.js'

@Controller('bloogs')
export class BloogsController {
  constructor(private readonly bloogs: BloogsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Page<BloogSummary>> {
    return this.bloogs.list(query)
  }

  /** Bloogs are addressed by username, as they were in the Rails app. */
  @Get(':username')
  findOne(
    @Param('username') username: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<BloogWithPosts> {
    return this.bloogs.findByUsername(username, query)
  }
}
