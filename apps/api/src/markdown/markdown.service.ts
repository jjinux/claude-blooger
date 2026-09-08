import { Injectable } from '@nestjs/common'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

/**
 * What a post body is allowed to contain once rendered. Anything else is dropped.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 's', 'blockquote',
    'ul', 'ol', 'li',
    'code', 'pre',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    // `rel` and `target` are set by the transformTags entry below. They must be
    // allowlisted here too, or sanitize-html strips the very attributes it just
    // added -- the filter runs after the transform.
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title'],
    // markdown-it puts the language on the <code> element as `language-ts`.
    code: ['class'],
    th: ['align'],
    td: ['align'],
  },
  // No `data:` and no `javascript:`. This is what stops `[x](javascript:alert(1))`.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    // Post bodies are user-authored, so outbound links get nofollow, and
    // noopener/noreferrer so the opened page cannot reach back via window.opener.
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'nofollow noopener noreferrer',
      target: '_blank',
    }),
  },
}

/**
 * Renders post bodies from Markdown to sanitized HTML.
 *
 * This is the single XSS-critical path in the application, so it is deliberately
 * the only place that turns user input into markup, and it defends twice:
 *
 *  1. `html: false` makes markdown-it escape raw HTML in the source rather than
 *     passing it through, so `<script>` never becomes a tag in the first place.
 *  2. sanitize-html then filters the generated tree against the allowlist above,
 *     which catches anything markdown-it itself might emit (notably link hrefs).
 *
 * Either alone would very likely be enough. Both together mean a change to one
 * does not silently become a vulnerability.
 */
@Injectable()
export class MarkdownService {
  private readonly renderer = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
  })

  render(markdown: string): string {
    return sanitizeHtml(this.renderer.render(markdown), SANITIZE_OPTIONS)
  }
}
