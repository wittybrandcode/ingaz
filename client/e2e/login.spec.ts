import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login as admin and see dashboard', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1, h2').first()).toBeVisible()

    await page.fill('input[type="email"], input[name="email"]', 'admin@ingaz.com')
    await page.fill('input[type="password"], input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/dashboard|projects/, { timeout: 10000 })
  })

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', 'wrong@test.com')
    await page.fill('input[type="password"], input[name="password"]', 'wrongpass')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=بيانات الدخول غير صحيحة')).toBeVisible({ timeout: 5000 })
  })

  test('access protected page without login redirects', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})
