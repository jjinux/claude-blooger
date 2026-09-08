import {
  type AdminUser,
  buildPage,
  type Page,
  type PaginationQuery,
  type PostSummary,
} from '@blooger/shared'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PostsService } from '../posts/posts.service.js'
import { UserEntity } from '../users/user.entity.js'

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly posts: PostsService,
  ) {}

  async listUsers(query: PaginationQuery): Promise<Page<AdminUser>> {
    const [users, total] = await this.users.findAndCount({
      loadEagerRelations: false,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    })

    const stats = await this.posts.statsByAuthor(users.map((user) => user.id))

    return buildPage(
      users.map((user) => ({
        id: user.id,
        username: user.username,
        bloogTitle: user.bloogTitle,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt.toISOString(),
        postCount: stats.get(user.id)?.postCount ?? 0,
      })),
      total,
      query,
    )
  }

  listPosts(query: PaginationQuery): Promise<Page<PostSummary>> {
    return this.posts.listRecent(query)
  }

  /** Deleting a user cascades to their posts and sessions at the database level. */
  async deleteUser(id: number, actor: UserEntity): Promise<void> {
    // Nothing stops an admin deleting another admin, but locking yourself out of
    // the section you are standing in is almost never what you meant.
    if (id === actor.id) {
      throw new BadRequestException('You cannot delete your own account from here')
    }

    const result = await this.users.delete({ id })
    if (!result.affected) throw new NotFoundException('No such user')
  }
}
