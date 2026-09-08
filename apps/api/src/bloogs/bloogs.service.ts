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
import { PostEntity } from '../posts/post.entity.js'
import { PostsService } from '../posts/posts.service.js'
import { UserEntity } from '../users/user.entity.js'

interface BloogStats {
  postCount: number
  latestPostAt: Date | null
}

@Injectable()
export class BloogsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
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

    const stats = await this.statsFor(users.map((user) => user.id))

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
      this.statsFor([user.id]),
      this.postsService.listForUser(user.id, query),
    ])

    return { bloog: toBloogSummary(user, stats.get(user.id)), posts }
  }

  /**
   * Post counts and latest-post timestamps for a page of users, in one grouped
   * query rather than a per-user count -- the N+1 this listing would otherwise be.
   */
  private async statsFor(userIds: number[]): Promise<Map<number, BloogStats>> {
    // `IN ()` with an empty list is a MySQL syntax error, so short-circuit.
    if (userIds.length === 0) return new Map()

    const rows = await this.posts
      .createQueryBuilder('post')
      .select('post.userId', 'userId')
      .addSelect('COUNT(*)', 'postCount')
      .addSelect('MAX(post.createdAt)', 'latestPostAt')
      .where('post.userId IN (:...userIds)', { userIds })
      .groupBy('post.userId')
      .getRawMany<{ userId: number; postCount: string | number; latestPostAt: Date | string | null }>()

    return new Map(
      rows.map((row) => [
        Number(row.userId),
        {
          // COUNT() comes back as a string from the MySQL driver.
          postCount: Number(row.postCount),
          latestPostAt: row.latestPostAt === null ? null : new Date(row.latestPostAt),
        },
      ]),
    )
  }
}

function toBloogSummary(user: UserEntity, stats: BloogStats | undefined): BloogSummary {
  return {
    username: user.username,
    bloogTitle: user.bloogTitle,
    // Absent from the stats map means the user has no posts at all.
    postCount: stats?.postCount ?? 0,
    latestPostAt: stats?.latestPostAt?.toISOString() ?? null,
  }
}
