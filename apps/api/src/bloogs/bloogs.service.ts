import {
  type BloogSummary,
  type BloogWithPosts,
  buildPage,
  type Page,
  type PaginationQuery,
} from '@blooger/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { AuthorPostStats } from '../posts/posts.service.js'
import { PostsService } from '../posts/posts.service.js'
import { UserEntity } from '../users/user.entity.js'

@Injectable()
export class BloogsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly postsService: PostsService,
  ) {}

  /** Every bloog on the site. The Rails original's homepage. */
  async list(query: PaginationQuery): Promise<Page<BloogSummary>> {
    const [users, total] = await this.users.findAndCount({
      loadEagerRelations: false,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    })

    const stats = await this.postsService.statsByAuthor(users.map((user) => user.id))

    return buildPage(
      users.map((user) => toBloogSummary(user, stats.get(user.id))),
      total,
      query,
    )
  }

  async findByUsername(username: string, query: PaginationQuery): Promise<BloogWithPosts> {
    const user = await this.users.findOne({
      where: { username },
      loadEagerRelations: false,
    })

    if (!user) throw new NotFoundException('No such bloog')

    const [stats, posts] = await Promise.all([
      this.postsService.statsByAuthor([user.id]),
      this.postsService.listForUser(user.id, query),
    ])

    return { bloog: toBloogSummary(user, stats.get(user.id)), posts }
  }
}

function toBloogSummary(user: UserEntity, stats: AuthorPostStats | undefined): BloogSummary {
  return {
    username: user.username,
    bloogTitle: user.bloogTitle,
    // Absent from the stats map means the user has no posts at all.
    postCount: stats?.postCount ?? 0,
    latestPostAt: stats?.latestPostAt?.toISOString() ?? null,
  }
}
