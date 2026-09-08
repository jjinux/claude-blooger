import type { PostSummary } from '@blooger/shared'
import { Inject, Injectable } from '@nestjs/common'
import { Feed } from 'feed'
import { BloogsService } from '../bloogs/bloogs.service.js'
import { ENV } from '../config/config.module.js'
import type { Env } from '../config/env.js'
import { PostsService } from '../posts/posts.service.js'

/** Feeds are a fixed window of recent posts, not a paginated archive. */
export const FEED_ITEM_LIMIT = 20

interface FeedInput {
  title: string
  description: string
  /** Path of the thing being syndicated, relative to APP_URL. '' for the whole site. */
  path: string
  items: PostSummary[]
}

@Injectable()
export class FeedsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly posts: PostsService,
    private readonly bloogs: BloogsService,
  ) {}

  async siteFeed(): Promise<Feed> {
    const page = await this.posts.listRecent({ page: 1, perPage: FEED_ITEM_LIMIT })

    return this.build({
      title: 'Blooger',
      description: 'Recent posts from every bloog.',
      path: '',
      items: page.items,
    })
  }

  /** Throws NotFoundException for an unknown username, via BloogsService. */
  async bloogFeed(username: string): Promise<Feed> {
    const { bloog, posts } = await this.bloogs.findByUsername(username, {
      page: 1,
      perPage: FEED_ITEM_LIMIT,
    })

    return this.build({
      title: bloog.bloogTitle,
      description: `Posts from ${bloog.bloogTitle}.`,
      path: `/bloogs/${bloog.username}`,
      items: posts.items,
    })
  }

  private build(input: FeedInput): Feed {
    // Feeds are consumed off-site, so every URL in them must be absolute.
    const base = this.env.APP_URL.replace(/\/+$/, '')
    const self = `${base}${input.path}`
    const newest = input.items[0]

    const feed = new Feed({
      title: input.title,
      description: input.description,
      id: `${self}/`,
      link: `${self}/`,
      language: 'en',
      copyright: `All content is the property of its respective authors.`,
      generator: 'blooger',
      // Absent when there are no posts at all, which readers handle fine.
      updated: newest ? new Date(newest.updatedAt) : undefined,
      feedLinks: {
        atom: `${self}/feed.atom`,
        rss: `${self}/feed.rss`,
        json: `${self}/feed.json`,
      },
    })

    for (const post of input.items) {
      const permalink = `${base}/bloogs/${post.author.username}/posts/${post.id}`

      feed.addItem({
        title: post.title,
        // The id must stay stable for the life of the post: a reader that sees a
        // new id treats the entry as a new, unread post. The permalink is stable
        // because the post id is.
        id: permalink,
        link: permalink,
        // Already rendered and sanitized by MarkdownService -- the same HTML the
        // API serves, so a feed reader and the site cannot disagree.
        content: post.bodyHtml,
        author: [{ name: post.author.username, link: `${base}/bloogs/${post.author.username}` }],
        published: new Date(post.createdAt),
        date: new Date(post.updatedAt),
      })
    }

    return feed
  }
}
