import { Global, Module } from '@nestjs/common'
import { MarkdownService } from './markdown.service.js'

/** Global: every feature that renders a post body needs exactly this one renderer. */
@Global()
@Module({
  providers: [MarkdownService],
  exports: [MarkdownService],
})
export class MarkdownModule {}
