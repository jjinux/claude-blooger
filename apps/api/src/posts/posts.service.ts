import {
  buildPage,
  type CreatePostInput,
  type Page,
  type PaginationQuery,
  type PostDetail,
  type PostSummary,
  type UpdatePostInput,
} from '@blooger/shared'
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MarkdownService } from '../markdown/markdown.service.js'
import type { UserEntity } from '../users/user.entity.js'
import { PostEntity } from './post.entity.js'

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
    private readonly markdown: MarkdownService,
  ) {}

  /** Site-wide recent posts, newest first. Drives the homepage. */
  listRecent(query: PaginationQuery): Promise<Page<PostSummary>> {
    return this.listWhere(query, {})
  }

  /** One bloog's posts, newest first. */
  listForUser(userId: number, query: PaginationQuery): Promise<Page<PostSummary>> {
    return this.listWhere(query, { userId })
  }

  async findDetail(id: number): Promise<PostDetail> {
    return this.toDetail(await this.findOwnedEntity(id))
  }

  async create(author: UserEntity, input: CreatePostInput): Promise<PostDetail> {
    const created = await this.posts.save(
      this.posts.create({ userId: author.id, title: input.title, body: input.body }),
    )

    // `save` returns the row without the relation, and toDetail needs the author.
    created.user = author
    return this.toDetail(created)
  }

  async update(id: number, actor: UserEntity, input: UpdatePostInput): Promise<PostDetail> {
    const post = await this.findOwnedEntity(id)
    this.assertMayModify(post, actor)

    if (input.title !== undefined) post.title = input.title
    if (input.body !== undefined) post.body = input.body

    const saved = await this.posts.save(post)
    saved.user = post.user
    return this.toDetail(saved)
  }

  async remove(id: number, actor: UserEntity): Promise<void> {
    const post = await this.findOwnedEntity(id)
    this.assertMayModify(post, actor)

    await this.posts.delete({ id: post.id })
  }

  /**
   * You may change your own posts; an admin may change anyone's.
   *
   * Deliberately a service-level check rather than a guard: the guard would have
   * to load the post to know who owns it, and then the handler would load it a
   * second time.
   */
  private assertMayModify(post: PostEntity, actor: UserEntity): void {
    if (actor.isAdmin || post.userId === actor.id) return
    throw new ForbiddenException('That is not your post')
  }

  private async listWhere(
    query: PaginationQuery,
    where: { userId?: number },
  ): Promise<Page<PostSummary>> {
    const [rows, total] = await this.posts.findAndCount({
      where,
      relations: { user: true },
      loadEagerRelations: false,
      // `id` breaks ties: two posts can share a timestamp, and without it the
      // ordering is unspecified, which makes pagination drop or repeat rows.
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    })

    return buildPage(
      rows.map((row) => this.toSummary(row)),
      total,
      query,
    )
  }

  private async findOwnedEntity(id: number): Promise<PostEntity> {
    const post = await this.posts.findOne({
      where: { id },
      relations: { user: true },
      loadEagerRelations: false,
    })

    if (!post) throw new NotFoundException('No such post')
    return post
  }

  private toSummary(post: PostEntity): PostSummary {
    // `Post.user` is non-nullable and cascades on delete, so a loaded post always
    // has an author. The relation is still typed optional because nothing is
    // eager-loaded, so this asserts what the schema already guarantees.
    const author = post.user
    if (!author) {
      throw new Error(`post ${post.id} was loaded without its author`)
    }

    return {
      id: post.id,
      title: post.title,
      bodyHtml: this.markdown.render(post.body),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      author: { username: author.username, bloogTitle: author.bloogTitle },
    }
  }

  private toDetail(post: PostEntity): PostDetail {
    return { ...this.toSummary(post), body: post.body }
  }
}
