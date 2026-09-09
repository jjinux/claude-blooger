import { Controller, Get, Header, Param } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiErrors } from '../docs/decorators.js'
import { FeedsService } from './feeds.service.js'

/**
 * Content types matter here: a reader picks its parser from the header, and
 * `application/json` on a JSON Feed makes some of them refuse it outright.
 */
const ATOM = 'application/atom+xml; charset=utf-8'
const RSS = 'application/rss+xml; charset=utf-8'
const JSON_FEED = 'application/feed+json; charset=utf-8'

/**
 * Feeds are public and identical for everybody, so let the browser, the reader,
 * and any CDN in front of us do the work.
 *
 * The ETag is Express's own, computed from the body, so a conditional request
 * costs a render and a hash but no transfer -- and once `s-maxage` is in play, a
 * CDN absorbs most requests without asking at all. `stale-while-revalidate` lets
 * it answer instantly from a stale copy while it refreshes behind the reader's
 * back; a feed an hour behind is not a problem worth a slow response.
 *
 * `public` is only safe because feeds never set a session cookie -- see the
 * session middleware in bootstrap.ts, which deliberately skips these paths.
 */
const FEED_CACHE_CONTROL = 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'

/**
 * Feeds deliberately sit outside the /api prefix -- they are not part of the JSON
 * API, and `/feed.atom` is the conventional place readers look. See the `exclude`
 * list in bootstrap.ts, which must stay in step with the routes below.
 *
 * All three formats come from one `Feed` object, so they cannot drift apart.
 */
@ApiTags('feeds')
@Controller()
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get('feed.atom')
  @Header('content-type', ATOM)
  @Header('cache-control', FEED_CACHE_CONTROL)
  @ApiOperation({ summary: 'Atom 1.0 feed of every bloog' })
  @ApiOkResponse({
    description: 'The feed document.',
    content: { [ATOM]: { schema: { type: 'string' } } },
  })
  async siteAtom(): Promise<string> {
    return (await this.feeds.siteFeed()).atom1()
  }

  @Get('feed.rss')
  @Header('content-type', RSS)
  @Header('cache-control', FEED_CACHE_CONTROL)
  @ApiOperation({ summary: 'RSS 2.0 feed of every bloog' })
  @ApiOkResponse({
    description: 'The feed document.',
    content: { [RSS]: { schema: { type: 'string' } } },
  })
  async siteRss(): Promise<string> {
    return (await this.feeds.siteFeed()).rss2()
  }

  @Get('feed.json')
  @Header('content-type', JSON_FEED)
  @Header('cache-control', FEED_CACHE_CONTROL)
  @ApiOperation({ summary: 'JSON Feed 1.1 feed of every bloog' })
  @ApiOkResponse({
    description: 'The feed document.',
    content: { [JSON_FEED]: { schema: { type: 'string' } } },
  })
  async siteJson(): Promise<string> {
    return (await this.feeds.siteFeed()).json1()
  }

  @Get('bloogs/:username/feed.atom')
  @Header('content-type', ATOM)
  @Header('cache-control', FEED_CACHE_CONTROL)
  @ApiOperation({ summary: 'Atom 1.0 feed of one bloog' })
  @ApiOkResponse({
    description: 'The feed document.',
    content: { [ATOM]: { schema: { type: 'string' } } },
  })
  @ApiErrors(404)
  async bloogAtom(@Param('username') username: string): Promise<string> {
    return (await this.feeds.bloogFeed(username)).atom1()
  }

  @Get('bloogs/:username/feed.rss')
  @Header('content-type', RSS)
  @Header('cache-control', FEED_CACHE_CONTROL)
  @ApiOperation({ summary: 'RSS 2.0 feed of one bloog' })
  @ApiOkResponse({
    description: 'The feed document.',
    content: { [RSS]: { schema: { type: 'string' } } },
  })
  @ApiErrors(404)
  async bloogRss(@Param('username') username: string): Promise<string> {
    return (await this.feeds.bloogFeed(username)).rss2()
  }

  @Get('bloogs/:username/feed.json')
  @Header('content-type', JSON_FEED)
  @Header('cache-control', FEED_CACHE_CONTROL)
  @ApiOperation({ summary: 'JSON Feed 1.1 feed of one bloog' })
  @ApiOkResponse({
    description: 'The feed document.',
    content: { [JSON_FEED]: { schema: { type: 'string' } } },
  })
  @ApiErrors(404)
  async bloogJson(@Param('username') username: string): Promise<string> {
    return (await this.feeds.bloogFeed(username)).json1()
  }
}
