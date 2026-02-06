/**
 * Label and filter deletion E2E tests
 * - Double-click label/filter in sidebar to open edit dialog
 * - Delete label and verify removal from sidebar
 * - Delete filter and verify removal from sidebar
 * - Edit label name via dialog
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'

let electronApp: ElectronApplication
let page: Page
const consoleErrors: string[] = []

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TODOER_TEST_MODE: 'true'
    }
  })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1000)

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
})

test.afterAll(async () => {
  await electronApp.close()
})

async function ensureSidebarVisible() {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  const sidebar = page.locator('aside').first()
  if (!(await sidebar.isVisible().catch(() => false))) {
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
  }
}

async function closeDialogs() {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

async function goToInbox() {
  await closeDialogs()
  await ensureSidebarVisible()
  await page.click('button:has-text("Today")')
  await page.waitForTimeout(300)
  await page.click('button:has-text("Inbox")')
  await page.waitForTimeout(500)
}

async function disableConfirmDelete() {
  // Set the setting in the DB and reload the page so settings cache picks it up
  await page.evaluate(() => {
    window.api.settings.set('confirmDelete', 'false')
  })
  await page.waitForTimeout(200)
  // Reload to clear settings cache
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1000)
}

test.describe.serial('Label and filter deletion', () => {
  test('setup: disable confirm delete', async () => {
    await disableConfirmDelete()
    await goToInbox()
  })

  test('should create a label via sidebar', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()

    // Click + next to Labels header
    const labelsSection = sidebar.locator('text=Labels').first().locator('..')
    await labelsSection.locator('button').click()
    await page.waitForTimeout(300)

    // Fill label dialog
    const dialog = page.locator('.fixed.inset-0').last()
    await dialog.locator('input[placeholder="Label name"]').fill('DeleteMe')
    await dialog.locator('button:has-text("Add")').click()
    await page.waitForTimeout(500)

    await expect(sidebar.locator('button:has-text("DeleteMe")')).toBeVisible()
  })

  test('should double-click label to open edit dialog', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()
    await sidebar.locator('button:has-text("DeleteMe")').first().dblclick()
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0').last()
    await expect(dialog.locator('text=Edit label')).toBeVisible()
    await expect(dialog.locator('button:has-text("Delete")')).toBeVisible()
    await expect(dialog.locator('input[placeholder="Label name"]')).toHaveValue('DeleteMe')

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('should edit label name via dialog', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()
    await sidebar.locator('button:has-text("DeleteMe")').first().dblclick()
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0').last()
    const nameInput = dialog.locator('input[placeholder="Label name"]')
    await nameInput.clear()
    await nameInput.fill('RenamedLabel')
    await dialog.locator('button:has-text("Save")').click()
    await page.waitForTimeout(500)

    // Old name gone, new name present
    await expect(sidebar.locator('button:has-text("DeleteMe")')).toHaveCount(0)
    await expect(sidebar.locator('button:has-text("RenamedLabel")')).toBeVisible()
  })

  test('should delete a label from sidebar', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()
    await sidebar.locator('button:has-text("RenamedLabel")').first().dblclick()
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0').last()
    await dialog.locator('button:has-text("Delete")').click()
    await page.waitForTimeout(500)

    await expect(sidebar.locator('button:has-text("RenamedLabel")')).toHaveCount(0)
  })

  test('should create a filter via sidebar', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()

    // Click + next to Filters header
    const filtersSection = sidebar.locator('text=Filters').first().locator('..')
    await filtersSection.locator('button').click()
    await page.waitForTimeout(300)

    const dialog = page.locator('.fixed.inset-0').last()
    await dialog.locator('input[placeholder="Filter name"]').fill('DeleteMeFilter')
    const queryInput = dialog.locator('input[placeholder*="today"]')
    await queryInput.fill('today & p1')
    await page.waitForTimeout(200)
    await dialog.locator('button:has-text("Add")').click()
    await page.waitForTimeout(500)

    await expect(sidebar.locator('button:has-text("DeleteMeFilter")')).toBeVisible()
  })

  test('should double-click filter to open edit dialog', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()
    await sidebar.locator('button:has-text("DeleteMeFilter")').first().dblclick()
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0').last()
    await expect(dialog.locator('text=Edit filter')).toBeVisible()
    await expect(dialog.locator('button:has-text("Delete")')).toBeVisible()
    await expect(dialog.locator('input[placeholder="Filter name"]')).toHaveValue('DeleteMeFilter')

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('should edit filter name via dialog', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()
    await sidebar.locator('button:has-text("DeleteMeFilter")').first().dblclick()
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0').last()
    const nameInput = dialog.locator('input[placeholder="Filter name"]')
    await nameInput.clear()
    await nameInput.fill('RenamedFilter')
    await dialog.locator('button:has-text("Save")').click()
    await page.waitForTimeout(500)

    await expect(sidebar.locator('button:has-text("DeleteMeFilter")')).toHaveCount(0)
    await expect(sidebar.locator('button:has-text("RenamedFilter")')).toBeVisible()
  })

  test('should delete a filter from sidebar', async () => {
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()
    await sidebar.locator('button:has-text("RenamedFilter")').first().dblclick()
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0').last()
    await dialog.locator('button:has-text("Delete")').click()
    await page.waitForTimeout(500)

    await expect(sidebar.locator('button:has-text("RenamedFilter")')).toHaveCount(0)
  })

  test('should have no console errors', () => {
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('Electron Security Warning') && !e.includes('DevTools')
    )
    expect(realErrors).toEqual([])
  })
})
