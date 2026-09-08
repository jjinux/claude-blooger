import { expect, test } from '@playwright/test'
import { publishPost, SEED_PASSWORD, uniqueUsername } from './helpers'

test('register, publish a post, and find it on the homepage and in the Atom feed', async ({
  page,
}) => {
  const username = uniqueUsername('nell')
  const bloogTitle = `${username}'s Bloog`

  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Bloog title').fill(bloogTitle)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Create my bloog' }).click()

  // Registration logs you straight in and drops you on your own, empty bloog.
  await expect(page).toHaveURL(`/bloogs/${username}`)
  await expect(page.getByRole('heading', { level: 1, name: bloogTitle })).toBeVisible()
  await expect(page.getByText('There are no bloog posts yet.')).toBeVisible()

  const title = `Hello from ${username}`
  await publishPost(page, title, 'A **bold** first post, in Markdown.')

  // Markdown is rendered by the server, so the emphasis arrives as a real
  // element rather than as asterisks.
  await expect(page.locator('.prose-blooger strong')).toHaveText('bold')

  // Newest first, so a post published just now leads the homepage.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(title)

  // The feed is served by Nest outside the /api prefix; Vite proxies it through.
  const feed = await page.request.get('/feed.atom')
  expect(feed.status()).toBe(200)
  expect(feed.headers()['content-type']).toContain('application/atom+xml')
  expect(await feed.text()).toContain(title)
})
