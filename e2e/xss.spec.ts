import { expect, test } from '@playwright/test'
import { login, publishPost } from './helpers'

/**
 * Asserts on the tags the browser ended up with, never on whether the payload's
 * characters appear in the page. An escaped `<script>` still contains the word
 * "script" as visible text, and on a blog engine someone will legitimately write
 * about script tags one day.
 */
test('a script in a post body reaches the DOM as inert text', async ({ page }) => {
  await login(page, 'jane')

  const body = [
    '<script>window.__pwned = true</script>',
    '',
    '<img src=x onerror="window.__pwned = true">',
    '',
    '[a link](javascript:window.__pwned = true)',
  ].join('\n')

  await publishPost(page, 'On the subject of script tags', body)

  const rendered = page.locator('.prose-blooger')

  // Nothing executable survived: no script element, no event-handler attribute,
  // and no javascript: URL.
  await expect(rendered.locator('script')).toHaveCount(0)
  expect(
    await rendered.evaluate(
      (root) =>
        [...root.querySelectorAll('*')].filter((element) =>
          [...element.attributes].some((attribute) => attribute.name.startsWith('on')),
        ).length,
    ),
  ).toBe(0)
  expect(await rendered.locator('a[href^="javascript:"]').count()).toBe(0)

  // And the proof that none of it ran.
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__pwned)).toBe(
    undefined,
  )

  // The payload is still there for the reader, as text.
  await expect(rendered).toContainText('<script>window.__pwned = true</script>')
})
