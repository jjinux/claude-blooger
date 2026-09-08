import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('an admin reaches the admin section', async ({ page }) => {
  await login(page, 'admin')

  await page.getByRole('link', { name: 'Admin' }).click()

  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Admin' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'joe', exact: true })).toBeVisible()
})

test('a normal user is refused it, by the API and not merely by the UI', async ({ page }) => {
  await login(page, 'joe')

  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)

  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Not allowed' })).toBeVisible()

  // The point of the test. Hiding the link is a courtesy; AdminGuard is the
  // boundary, and it is what has to say no when the browser asks anyway.
  const response = await page.request.get('/api/admin/users')
  expect(response.status()).toBe(403)
})
