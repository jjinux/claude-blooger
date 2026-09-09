import { describe, expect, it } from 'vitest'
import { MarkdownService } from './markdown.service.js'

const markdown = new MarkdownService()

/** Every real HTML tag in the output. Escaped text like `&lt;script&gt;` is not one. */
function tagsIn(html: string): string[] {
  return html.match(/<[^>]+>/g) ?? []
}

/**
 * Asserts the rendered output cannot execute anything.
 *
 * Checking tags rather than raw substrings matters: a payload that has been
 * *escaped* still contains the characters "script" or "onerror" as visible text,
 * and that text is perfectly safe. Only markup can hurt you.
 */
function expectInert(html: string): void {
  const tags = tagsIn(html)

  expect(
    tags.filter((tag) => /^<\s*\/?\s*(script|iframe|style|object|embed|form)\b/i.test(tag)),
  ).toEqual([])
  expect(tags.filter((tag) => /\son\w+\s*=/i.test(tag))).toEqual([])
  expect(
    tags.filter((tag) => /(href|src)\s*=\s*["']?\s*(javascript|data|vbscript):/i.test(tag)),
  ).toEqual([])
}

describe('MarkdownService', () => {
  describe('rendering', () => {
    it('renders basic Markdown', () => {
      expect(markdown.render('# Title')).toContain('<h1>Title</h1>')
      expect(markdown.render('**bold**')).toContain('<strong>bold</strong>')
      expect(markdown.render('- one\n- two')).toContain('<li>one</li>')
    })

    it('renders fenced code, keeping the language class', () => {
      const html = markdown.render('```ts\nconst x = 1\n```')
      expect(html).toContain('<pre>')
      expect(html).toContain('class="language-ts"')
      expect(html).toContain('const x = 1')
    })

    it('keeps ordinary links and marks them up safely', () => {
      const html = markdown.render('[docs](https://example.com/)')
      expect(html).toContain('href="https://example.com/"')
      expect(html).toContain('rel="nofollow noopener noreferrer"')
      expect(html).toContain('target="_blank"')
    })
  })

  describe('XSS', () => {
    it('escapes a raw script tag instead of emitting one', () => {
      const html = markdown.render('<script>alert(1)</script>')

      expectInert(html)
      // Escaped, not silently deleted -- the author still sees what they typed.
      expect(html).toContain('&lt;script&gt;')
    })

    it('neutralises an inline event handler', () => {
      expectInert(markdown.render('<img src=x onerror="alert(1)">'))
    })

    it('refuses a javascript: link', () => {
      // markdown-it's own validateLink rejects the scheme, so this never becomes
      // an anchor at all; sanitize-html is the backstop if that ever changes.
      const html = markdown.render('[click](javascript:alert(1))')

      expectInert(html)
      expect(html).not.toContain('<a ')
    })

    it('refuses a data: image source', () => {
      const html = markdown.render('![x](data:text/html;base64,PHNjcmlwdD4=)')

      expectInert(html)
      expect(html).not.toContain('<img')
    })

    it('drops an iframe', () => {
      expectInert(markdown.render('<iframe src="https://evil.example"></iframe>'))
    })

    it('drops a style block', () => {
      expectInert(markdown.render('<style>body{display:none}</style>'))
    })

    /**
     * Mutation-XSS vectors: payloads that survive a sanitizer and then become
     * something else when the browser re-parses the sanitizer's own output.
     *
     * They are here because they are the case DOMPurify is chiefly credited with
     * handling, and the investigation recorded in TODO.md concluded this pipeline
     * does not need it. Every one of these depends on an element whose content is
     * parsed in a foreign context -- `noscript`, `style`, `svg`, `math`,
     * `template`, `xmp`. `html: false` means none of them can exist in the first
     * place: markdown-it escapes the source, so what reaches sanitize-html is
     * already text.
     *
     * This block is the evidence for that conclusion, so if `html` is ever turned
     * on, the conclusion fails here rather than in production.
     */
    describe('mutation XSS', () => {
      const VECTORS: [string, string][] = [
        ['noscript', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'],
        ['style in svg', '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">'],
        [
          'mglyph in table',
          '<math><mtext><table><mglyph><style><!--</style><img src=1 onerror=alert(1)>',
        ],
        [
          'form and mglyph',
          '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
        ],
        ['template', '<template><script>alert(1)</script></template>'],
        ['comment breakout', '<!--><script>alert(1)</script>-->'],
        ['xmp', '<xmp><script>alert(1)</script></xmp>'],
      ]

      it.each(VECTORS)('leaves %s inert', (_name, payload) => {
        expectInert(markdown.render(payload))
      })
    })

    it('survives a mixed payload', () => {
      expectInert(
        markdown.render(
          [
            '# Title',
            '',
            '<svg/onload=alert(1)>',
            '[a](javascript:alert(1))',
            '<form action="/x">',
          ].join('\n'),
        ),
      )
    })
  })
})
