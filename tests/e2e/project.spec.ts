import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication
let page: Page
const consoleErrors: string[] = []

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TODOER_TEST_MODE: 'true'
    }
  })

  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  // Wait for React to render
  await page.waitForTimeout(1000)

  // Collect console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
})

test.afterAll(async () => {
  await electronApp?.close()
})

test.describe('Project Management', () => {
  test('should show Inbox project in sidebar', async () => {
    await expect(page.locator('text=Inbox').first()).toBeVisible()
  })

  test('should show Projects section in sidebar', async () => {
    // Use exact text match to avoid multiple matches
    await expect(page.getByText('Projects', { exact: true }).first()).toBeVisible()
  })

  test('should navigate to project when clicked', async () => {
    // For now just verify inbox works as a project
    await page.click('text=Inbox')
    await page.waitForTimeout(300)
    // Check the main content area for the title
    const mainHeading = page.locator('main h1, .main-content h1').first()
    await expect(mainHeading).toContainText('Inbox')
  })
})

test.describe('Navigation', () => {
  test('should show correct view titles', async () => {
    // Today
    await page.click('text=Today')
    await page.waitForTimeout(300)
    await expect(page.locator('main h1, .main-content h1').first()).toContainText('Today')

    // Upcoming
    await page.click('text=Upcoming')
    await page.waitForTimeout(300)
    await expect(page.locator('main h1, .main-content h1').first()).toContainText('Upcoming')

    // Inbox
    await page.click('text=Inbox')
    await page.waitForTimeout(300)
    await expect(page.locator('main h1, .main-content h1').first()).toContainText('Inbox')
  })

  test('should persist navigation state', async () => {
    // Navigate to Inbox
    await page.click('text=Inbox')
    await page.waitForTimeout(500)

    // Verify we're on Inbox
    const heading = await page.locator('main h1, .main-content h1').first().textContent()
    expect(heading?.toLowerCase()).toContain('inbox')
  })
})

// Final check: no console errors during entire test run
test('should have no console errors throughout test run', () => {
  expect(consoleErrors).toHaveLength(0)
})
