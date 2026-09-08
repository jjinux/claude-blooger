import { Controller, Get, Header, Param } from '@nestjs/common'
import { FeedsService } from './feeds.service.js'

/**
 * Content types matter here: a reader picks its parser from the header, and
 * `application/json` on a JSON Feed makes some of them refuse it outright.
 */
const ATOM = 'application/atom+xml; charset=utf-8'
const RSS = 'application/rss+xml; charset=utf-8'
const JSON_FEED = 'application/feed+json; charset=utf-8'

/**
 * Feeds deliberately sit outside the /api prefix -- they are not part of the JSON
 * API, and `/feed.atom` is the conventional place readers look. See the `exclude`
 * list in bootstrap.ts, which must stay in step with the routes below.
 *
 * All three formats come from one `Feed` object, so they cannot drift apart.
 */
@Controller()
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get('feed.atom')
  @Header('content-type', ATOM)
  async siteAtom(): Promise<string> {
    return (await this.feeds.siteFeed()).atom1()
  }

  @Get('feed.rss')
  @Header('content-type', RSS)
  async siteRss(): Promise<string> {
    return (await this.feeds.siteFeed()).rss2()
  }

  @Get('feed.json')
  @Header('content-type', JSON_FEED)
  async siteJson(): Promise<string> {
    return (await this.feeds.siteFeed()).json1()
  }

  @Get('bloogs/:username/feed.atom')
  @Header('content-type', ATOM)
  async bloogAtom(@Param('username') username: string): Promise<string> {
    return (await this.feeds.bloogFeed(username)).atom1()
  }

  @Get('bloogs/:username/feed.rss')
  @Header('content-type', RSS)
  async bloogRss(@Param('username') username: string): Promise<string> {
    return (await this.feeds.bloogFeed(username)).rss2()
  }

  @Get('bloogs/:username/feed.json')
  @Header('content-type', JSON_FEED)
  async bloogJson(@Param('username') username: string): Promise<string> {
    return (await this.feeds.bloogFeed(username)).json1()
  }
}
