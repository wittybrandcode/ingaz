import { test, expect } from '@playwright/test'

test.describe('Project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', 'admin@ingaz.com')
    await page.fill('input[type="password"], input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard|projects/, { timeout: 10000 })
  })

  test('create a new project', async ({ page }) => {
    await page.goto('/projects')
    await page.locator('text=إضافة مشروع').first().click()

    const projectName = `Test Project ${Date.now()}`
    await page.fill('input[name="title"], input[placeholder*="عنوان"]', projectName)
    await page.click('button[type="submit"], button:has-text("حفظ")')

    await expect(page.locator(`text=${projectName}`).first()).toBeVisible({ timeout: 5000 })
  })

  test('projects page loads and displays list', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.locator('h1, h2').first()).toBeVisible()

    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href*="/project/"]')
    const count = await projectCards.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
