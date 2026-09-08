import { expect, type Page } from '@playwright/test'

/** Every seeded account shares this. See apps/api/src/database/seed.ts. */
export const SEED_PASSWORD = 'password123'

/**
 * A name no other run has used. The database is seeded once for the whole suite
 * and never cleaned between specs, so a fixed username would pass on a fresh
 * database and fail with "already taken" on the second run.
 */
export function uniqueUsername(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Logs in through the real form.
 *
 * `fill()` rather than `type()` or a DOM assignment: React's controlled inputs
 * only update their state from a real change event, and setting `.value`
 * directly leaves the component's state empty so the form submits blanks.
 * Playwright's fill() does the right thing; this is written down because two
 * other ways of driving these fields did not.
 */
export async function login(page: Page, username: string, password = SEED_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()

  // The header only offers this once a session exists, so it is the honest
  // signal that the login landed rather than just that the button was clicked.
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
}

/** Publishes a post from /posts/new and returns once its permalink has rendered. */
export async function publishPost(page: Page, title: string, body: string) {
  await page.goto('/posts/new')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Body').fill(body)
  await page.getByRole('button', { name: 'Publish' }).click()

  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(page).toHaveURL(/\/bloogs\/[^/]+\/posts\/\d+$/)
}
