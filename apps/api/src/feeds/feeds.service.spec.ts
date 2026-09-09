import type { BloogWithPosts, Page, PostSummary } from '@blooger/shared'
import { describe, expect, it } from 'vitest'
import type { BloogsService } from '../bloogs/bloogs.service.js'
import type { Env } from '../config/env.js'
import type { PostsService } from '../posts/posts.service.js'
import { FEED_ITEM_LIMIT, FeedsService } from './feeds.service.js'

/**
 * No database and no HTTP: the services are stubs, so this can ask questions the
 * integration specs cannot set up cheaply -- what a feed looks like with no posts
 * at all, or what happens to a trailing slash in APP_URL.
 */
function makePost(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id: 1,
    title: 'A post',
    bodyHtml: '<p>Hello</p>',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    author: { username: 'joe', bloogTitle: "Joe's Bloog" },
    ...overrides,
  }
}

function pageOf(items: PostSummary[]): Page<PostSummary> {
  return {
    items,
    page: 1,
    perPage: FEED_ITEM_LIMIT,
    totalItems: items.length,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  }
}

function makeService(items: PostSummary[], appUrl = 'https://blooger.example') {
  const posts = { listRecent: () => Promise.resolve(pageOf(items)) } as unknown as PostsService
  const bloogs = {
    findByUsername: (username: string): Promise<BloogWithPosts> =>
      Promise.resolve({
        bloog: {
          username,
          bloogTitle: "Joe's Bloog",
          postCount: items.length,
          latestPostAt: items[0]?.updatedAt ?? null,
        },
        posts: pageOf(items),
      }),
  } as unknown as BloogsService

  return new FeedsService({ APP_URL: appUrl } as Env, posts, bloogs)
}

const updatedIn = (xml: string) => /<updated>([^<]*)<\/updated>/.exec(xml)?.[1]

describe('FeedsService', () => {
  it('dates the feed from the newest post, never from the clock', async () => {
    const feed = await makeService([
      makePost({ id: 2, updatedAt: '2026-03-04T05:06:07.000Z' }),
      makePost({ id: 1, updatedAt: '2026-01-01T00:00:00.000Z' }),
    ]).siteFeed()

    expect(updatedIn(feed.atom1())).toBe('2026-03-04T05:06:07.000Z')
  })

  /**
   * The empty case is the one that broke caching. Atom requires a feed-level
   * `<updated>`, and the `feed` package fills in `new Date()` when given none --
   * so an empty feed used to differ on every request and its ETag never matched.
   */
  it('dates an empty feed from the epoch, so it is byte-stable', async () => {
    const service = makeService([])

    const first = (await service.siteFeed()).atom1()
    const second = (await service.siteFeed()).atom1()

    expect(updatedIn(first)).toBe('1970-01-01T00:00:00.000Z')
    expect(first).toBe(second)
  })

  it('is byte-stable with posts, too', async () => {
    const service = makeService([makePost()])

    expect((await service.siteFeed()).atom1()).toBe((await service.siteFeed()).atom1())
    expect((await service.siteFeed()).rss2()).toBe((await service.siteFeed()).rss2())
    expect((await service.siteFeed()).json1()).toBe((await service.siteFeed()).json1())
  })

  it('strips trailing slashes from APP_URL rather than doubling them', async () => {
    const feed = await makeService([makePost({ id: 7 })], 'https://blooger.example///').siteFeed()
    const xml = feed.atom1()

    expect(xml).toContain('https://blooger.example/bloogs/joe/posts/7')
    expect(xml).not.toContain('example//')
  })

  it('uses absolute URLs everywhere, because a feed is read off-site', async () => {
    const xml = (await makeService([makePost({ id: 7 })]).siteFeed()).atom1()
    const hrefs = [...xml.matchAll(/(?:href|<id>)="?([^"<]+)/g)].map((match) => match[1])

    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href, href).toMatch(/^https:\/\/blooger\.example/)
    }
  })

  it('carries the server-rendered HTML rather than Markdown', async () => {
    const xml = (
      await makeService([
        makePost({ bodyHtml: '<p>Already <strong>rendered</strong></p>' }),
      ]).siteFeed()
    ).atom1()

    expect(xml).toContain('Already')
    expect(xml).toContain('strong')
  })

  it('gives a per-bloog feed its own self link and title', async () => {
    const xml = (await makeService([makePost()]).bloogFeed('joe')).atom1()

    expect(xml).toContain('<link rel="self" href="https://blooger.example/bloogs/joe/feed.atom"/>')
    // An apostrophe is legal as-is in element content -- only `<` and `&` have to
    // be escaped there. That the document still parses is the integration spec's
    // job, with a real XML parser.
    expect(xml).toContain("<title>Joe's Bloog</title>")
  })

  it('emits all three formats from one definition', async () => {
    const feed = await makeService([makePost({ title: 'Shared title' })]).siteFeed()

    expect(feed.atom1()).toContain('Shared title')
    expect(feed.rss2()).toContain('Shared title')
    expect(JSON.parse(feed.json1()).items[0].title).toBe('Shared title')
  })
})
