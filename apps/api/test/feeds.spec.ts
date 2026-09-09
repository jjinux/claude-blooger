import { CSRF_HEADER } from '@blooger/shared'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, registerUser, type TestApp, type TestUser, truncateAll } from './harness.js'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' })

/** The Nokogiri check from the Rails Cucumber suite, in TypeScript. */
function parseWellFormedXml(body: string): Record<string, any> {
  const validation = XMLValidator.validate(body)
  if (validation !== true) {
    throw new Error(`not well-formed XML: ${JSON.stringify(validation.err)}`)
  }
  return parser.parse(body) as Record<string, any>
}

/**
 * The `feed` package emits `<title type="html">`, so with attribute parsing on, a
 * text node arrives as `{ '#text': ..., '@type': ... }` rather than a bare string.
 */
function textOf(node: unknown): string {
  if (node === null || node === undefined) return ''
  if (typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)['#text'])
  }
  return String(node)
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

describe('feeds', () => {
  let ctx: TestApp
  let joe: TestUser

  beforeAll(async () => {
    ctx = await createTestApp()
  }, 30_000)

  afterAll(async () => {
    await ctx?.close()
  })

  beforeEach(async () => {
    await truncateAll(ctx.dataSource)
    ctx.resetRateLimits()
    joe = await registerUser(ctx.agent)
  })

  const addPost = (title: string, body = 'Hello **world**') =>
    ctx.agent.post('/api/posts').set(CSRF_HEADER, joe.csrfToken).send({ title, body })

  describe('routing', () => {
    it('serves feeds outside the /api prefix', async () => {
      await ctx.agent.get('/feed.atom').expect(200)
      await ctx.agent.get('/feed.rss').expect(200)
      await ctx.agent.get('/feed.json').expect(200)
    })

    it('does not also serve them under /api', async () => {
      await ctx.agent.get('/api/feed.atom').expect(404)
    })

    it('serves a per-bloog feed', async () => {
      await ctx.agent.get('/bloogs/joe/feed.atom').expect(200)
      await ctx.agent.get('/bloogs/joe/feed.rss').expect(200)
      await ctx.agent.get('/bloogs/joe/feed.json').expect(200)
    })

    it('404s a feed for an unknown bloog', async () => {
      await ctx.agent.get('/bloogs/nobody/feed.atom').expect(404)
    })

    it('needs no login', async () => {
      await ctx.newAgent().get('/feed.atom').expect(200)
    })
  })

  describe('caching', () => {
    const FEEDS = ['/feed.atom', '/feed.rss', '/feed.json', '/bloogs/joe/feed.atom']

    it.each(FEEDS)('marks %s publicly cacheable', async (path) => {
      const response = await ctx.agent.get(path).expect(200)
      const cacheControl = response.headers['cache-control']

      expect(cacheControl).toContain('public')
      expect(cacheControl).toContain('max-age=300')
      expect(cacheControl).toContain('s-maxage=900')
      expect(cacheControl).toContain('stale-while-revalidate=3600')
    })

    it.each(FEEDS)('answers a conditional request for %s with 304 and no body', async (path) => {
      const first = await ctx.agent.get(path).expect(200)
      const etag = first.headers.etag as string

      expect(etag).toBeTruthy()

      const second = await ctx.agent.get(path).set('If-None-Match', etag).expect(304)
      expect(second.text).toBeFalsy()
      // A 304 has to carry the validator, or the cache cannot refresh its entry.
      expect(second.headers.etag).toBe(etag)
    })

    /**
     * Found by the 304 test above, which is the only reason it was noticed.
     *
     * Atom requires a feed-level `<updated>`, and the `feed` package fills in
     * `new Date()` when given none -- at millisecond resolution. An empty Atom
     * feed was therefore different on every request, so its ETag never matched
     * and a reader polling an empty bloog re-downloaded it forever. RSS and JSON
     * Feed do not show the field, which is how it stayed hidden.
     */
    it.each(['/feed.atom', '/feed.rss', '/feed.json'])(
      'serializes %s identically when nothing has changed, even with no posts',
      async (path) => {
        const first = await ctx.agent.get(path).expect(200)
        const second = await ctx.agent.get(path).expect(200)

        expect(second.text).toBe(first.text)
        expect(second.headers.etag).toBe(first.headers.etag)
      },
    )

    it('changes the ETag when a post is published', async () => {
      const before = (await ctx.agent.get('/feed.atom').expect(200)).headers.etag as string
      await addPost('Something new').expect(201)
      const after = (await ctx.agent.get('/feed.atom').expect(200)).headers.etag as string

      expect(after).not.toBe(before)
      // And the old validator no longer matches, so a cache refetches.
      await ctx.agent.get('/feed.atom').set('If-None-Match', before).expect(200)
    })

    /**
     * The reason feeds skip the session middleware.
     *
     * `rolling: true` re-sends an existing session's cookie on every request it
     * touches. On a response marked `Cache-Control: public`, a shared cache that
     * stored that would hand one reader's session to the next visitor. Most CDNs
     * decline to cache a response carrying Set-Cookie, but that is a convention,
     * not a boundary -- so the cookie must not be there in the first place.
     */
    it('never sets a cookie, even for a reader who is logged in', async () => {
      // `ctx.agent` has been logged in by registerUser, and proves it here.
      const account = await ctx.agent.get('/api/account').expect(200)
      expect(account.headers['set-cookie']).toBeDefined()

      for (const path of FEEDS) {
        const response = await ctx.agent.get(path).expect(200)
        expect(response.headers['set-cookie'], path).toBeUndefined()
      }
    })

    it('leaves the JSON API uncached', async () => {
      const response = await ctx.agent.get('/api/posts').expect(200)
      expect(response.headers['cache-control']).toBeUndefined()
    })
  })

  describe('content types', () => {
    it.each([
      ['/feed.atom', 'application/atom+xml'],
      ['/feed.rss', 'application/rss+xml'],
      ['/feed.json', 'application/feed+json'],
    ])('serves %s as %s', async (path, expected) => {
      const response = await ctx.agent.get(path).expect(200)
      expect(response.headers['content-type']).toContain(expected)
      expect(response.headers['content-type']).toContain('charset=utf-8')
    })
  })

  describe('Atom', () => {
    it('is well-formed and lists the posts', async () => {
      await addPost('First').expect(201)
      await addPost('Second').expect(201)

      const response = await ctx.agent.get('/feed.atom').expect(200)
      const feed = parseWellFormedXml(response.text).feed

      expect(feed).toBeDefined()
      const titles = asArray(feed.entry).map((entry: any) => textOf(entry.title))
      expect(titles).toEqual(['Second', 'First'])
    })

    it('is well-formed with no posts at all', async () => {
      const response = await ctx.agent.get('/feed.atom').expect(200)
      const feed = parseWellFormedXml(response.text).feed

      expect(feed).toBeDefined()
      expect(asArray(feed.entry)).toHaveLength(0)
    })

    it('uses absolute URLs for entry ids', async () => {
      await addPost('First').expect(201)

      const response = await ctx.agent.get('/feed.atom').expect(200)
      const entry = asArray(parseWellFormedXml(response.text).feed.entry)[0]

      expect(String(entry.id)).toMatch(/^https?:\/\/.+\/bloogs\/joe\/posts\/\d+$/)
    })

    it('keeps entry ids stable across requests', async () => {
      await addPost('First').expect(201)

      const idOf = async () => {
        const response = await ctx.agent.get('/feed.atom').expect(200)
        return String(asArray(parseWellFormedXml(response.text).feed.entry)[0].id)
      }

      // A reader treats a changed id as a new unread post, so this must not drift.
      expect(await idOf()).toBe(await idOf())
    })

    it('carries the rendered HTML, not raw Markdown', async () => {
      await addPost('Formatted', 'Hello **world**').expect(201)

      const response = await ctx.agent.get('/feed.atom').expect(200)
      const entry = asArray(parseWellFormedXml(response.text).feed.entry)[0]
      const content = textOf(entry.content)

      // Content is wrapped in CDATA, so the HTML is not entity-escaped.
      expect(content).toContain('<strong>world</strong>')
      expect(content).not.toContain('**world**')
    })

    it('stays well-formed when a post tries to close the CDATA section', async () => {
      // `]]>` in the body would end the CDATA early and let the rest of the post
      // be parsed as markup. Two things prevent it: markdown-it escapes `>` to
      // `&gt;` before this point, and the feed library splits any literal `]]>`
      // into `]]]]><![CDATA[>`. This asserts the whole chain, not either half.
      await addPost('Escape', 'before ]]><script>alert(1)</script> after').expect(201)

      const response = await ctx.agent.get('/feed.atom').expect(200)
      const feed = parseWellFormedXml(response.text).feed
      const entry = asArray(feed.entry)[0]

      expect(textOf(entry.content)).not.toMatch(/<\s*script/i)
    })

    it('carries sanitized HTML', async () => {
      await addPost('Nasty', '<script>alert(1)</script>').expect(201)

      const response = await ctx.agent.get('/feed.atom').expect(200)
      // Well-formedness alone would not catch this; the content is escaped twice
      // over, but assert no live tag survived into the entry content.
      const entry = asArray(parseWellFormedXml(response.text).feed.entry)[0]
      expect(textOf(entry.content)).not.toMatch(/<\s*script/i)
    })
  })

  describe('RSS', () => {
    it('is well-formed and lists the posts', async () => {
      await addPost('First').expect(201)

      const response = await ctx.agent.get('/feed.rss').expect(200)
      const channel = parseWellFormedXml(response.text).rss.channel

      expect(channel).toBeDefined()
      expect(asArray(channel.item).map((item: any) => textOf(item.title))).toEqual(['First'])
    })
  })

  describe('JSON Feed', () => {
    it('is valid JSON Feed', async () => {
      await addPost('First').expect(201)

      const response = await ctx.agent.get('/feed.json').expect(200)
      const feed = JSON.parse(response.text) as {
        version: string
        items: Array<{ id: string; title: string }>
      }

      expect(feed.version).toContain('jsonfeed.org')
      expect(feed.items.map((item) => item.title)).toEqual(['First'])
      expect(feed.items[0]?.id).toMatch(/^https?:\/\//)
    })
  })

  describe('per-bloog scoping', () => {
    it("includes only that bloog's posts", async () => {
      await addPost('Joe post').expect(201)

      const janeAgent = ctx.newAgent()
      const jane = await registerUser(janeAgent, { username: 'jane', bloogTitle: 'Jane Bloogs' })
      await janeAgent
        .post('/api/posts')
        .set(CSRF_HEADER, jane.csrfToken)
        .send({ title: 'Jane post', body: 'x' })
        .expect(201)

      const response = await ctx.agent.get('/bloogs/joe/feed.atom').expect(200)
      const titles = asArray(parseWellFormedXml(response.text).feed.entry).map((e: any) =>
        textOf(e.title),
      )

      expect(titles).toEqual(['Joe post'])
    })

    it('titles the feed after the bloog, and self-links to itself', async () => {
      await addPost('Joe post').expect(201)

      const response = await ctx.agent.get('/bloogs/joe/feed.atom').expect(200)
      const feed = parseWellFormedXml(response.text).feed

      expect(textOf(feed.title)).toBe("Joe's Bloog")
      expect(response.text).toContain('/bloogs/joe/feed.atom')
    })

    it('the site feed includes every bloog', async () => {
      await addPost('Joe post').expect(201)

      const janeAgent = ctx.newAgent()
      const jane = await registerUser(janeAgent, { username: 'jane', bloogTitle: 'Jane Bloogs' })
      await janeAgent
        .post('/api/posts')
        .set(CSRF_HEADER, jane.csrfToken)
        .send({ title: 'Jane post', body: 'x' })
        .expect(201)

      const response = await ctx.agent.get('/feed.atom').expect(200)
      const titles = asArray(parseWellFormedXml(response.text).feed.entry).map((e: any) =>
        textOf(e.title),
      )

      expect(titles.sort()).toEqual(['Jane post', 'Joe post'])
    })
  })
})

describe('api 404s', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = await createTestApp()
  }, 30_000)

  afterAll(async () => {
    await ctx?.close()
  })

  it('answers an unmatched /api path with JSON, not an HTML page', async () => {
    const response = await ctx.agent.get('/api/nope').expect(404)

    expect(response.headers['content-type']).toContain('application/json')
    expect(response.body).toMatchObject({ statusCode: 404, error: 'Not Found' })
  })
})
