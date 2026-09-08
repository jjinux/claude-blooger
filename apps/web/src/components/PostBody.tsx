/**
 * Renders a post body.
 *
 * `bodyHtml` is produced and sanitized by the server's MarkdownService, which is
 * the single place in the system that turns Markdown into markup. The SPA never
 * parses Markdown itself -- one renderer, one sanitizer, no second attack surface.
 *
 * See the DOMPurify note in TODO.md: adding a client-side pass here, right at the
 * point of injection, is the cheapest place to add a third layer if we want one.
 */
export function PostBody({ html }: { html: string }) {
  return (
    <div
      className="prose-blooger"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
