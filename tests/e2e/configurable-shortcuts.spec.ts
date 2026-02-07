/**
 * E2E tests for configurable keyboard shortcuts (Issue #3).
 * Covers: shortcuts reference page, settings UI, changing shortcuts, reset.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchElectron } from './helpers'

let electronApp: ElectronApplication
let page: Page
const consoleErrors: string[] = []

test.beforeAll(async () => {
  electronApp = await launchElectron()
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

async function closeDialogs() {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

async function blurActive() {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.waitForTimeout(100)
}

async function ensureSidebarVisible() {
  const sidebar = page.locator('aside').first()
  if (!(await sidebar.isVisible().catch(() => false))) {
    await blurActive()
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
  }
}

async function goToToday() {
  await closeDialogs()
  await ensureSidebarVisible()
  // Use sidebar nav button specifically
  const sidebar = page.locator('aside').first()
  await sidebar.locator('button:has-text("Today")').click()
  await page.waitForTimeout(500)
  // Wait for Today heading to appear
  await page.waitForSelector('h1:has-text("Today")', { timeout: 3000 }).catch(() => {})
  await blurActive()
}

test.describe('Keyboard Shortcuts Reference Page', () => {
  test('shows shortcuts help dialog with all categories', async () => {
    // Ensure we're on Today view with nothing focused
    await closeDialogs()
    await ensureSidebarVisible()
    const sidebar = page.locator('aside').first()
    await sidebar.locator('button:has-text("Inbox")').click()
    await page.waitForTimeout(500)
    await sidebar.locator('button:has-text("Today")').click()
    await page.waitForTimeout(500)

    // Click on a non-interactive area and blur
    await page.click('h1:has-text("Today")')
    await page.waitForTimeout(100)
    await blurActive()
    await page.waitForTimeout(100)

    // Press ? to open help
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }))
    })
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0')
    await expect(dialog).toBeVisible()

    // Check all categories are present
    await expect(dialog.locator('h3:has-text("General")')).toBeVisible()
    await expect(dialog.locator('h3:has-text("Navigation")')).toBeVisible()
    await expect(dialog.locator('h3:has-text("Task List")')).toBeVisible()

    // Check some known shortcuts are listed
    await expect(dialog.locator('text=Quick add task')).toBeVisible()
    await expect(dialog.locator('text=Toggle sidebar')).toBeVisible()
    await expect(dialog.locator('text=Go to Today')).toBeVisible()
    await expect(dialog.locator('text=Move focus down')).toBeVisible()

    // Close
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('shortcuts reference shows key bindings as kbd elements', async () => {
    // Ensure we're on Today view with nothing focused
    await closeDialogs()
    await page.click('h1:has-text("Today")')
    await page.waitForTimeout(100)
    await blurActive()
    await page.waitForTimeout(100)
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }))
    })
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0')
    // Should have multiple kbd elements
    const kbdCount = await dialog.locator('kbd').count()
    expect(kbdCount).toBeGreaterThan(10)

    // Check a chord display (G then T for Go to Today)
    const thenSpans = dialog.locator('text=then')
    const thenCount = await thenSpans.count()
    expect(thenCount).toBeGreaterThan(0) // At least navigation chords

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })
})

test.describe('Keyboard Shortcuts Settings', () => {
  test('settings panel has Keyboard Shortcuts section', async () => {
    await closeDialogs()
    // Open settings with Ctrl+,
    await page.keyboard.press('Control+,')
    await page.waitForTimeout(500)

    const settingsDialog = page.locator('.fixed.inset-0').last()
    await expect(settingsDialog).toBeVisible()

    // Should have Keyboard Shortcuts heading
    await expect(settingsDialog.locator('h3:has-text("Keyboard Shortcuts")')).toBeVisible()

    // Should show shortcut actions
    await expect(settingsDialog.locator('text=Quick add task')).toBeVisible()
    await expect(settingsDialog.locator('text=Search')).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('can click a shortcut to enter edit mode', async () => {
    await closeDialogs()
    await page.keyboard.press('Control+,')
    await page.waitForTimeout(500)

    const settingsDialog = page.locator('.fixed.inset-0').last()

    // Find the "Quick add task" row and click its kbd
    const quickAddRow = settingsDialog.locator('div:has(> span:text-is("Quick add task"))')
    const kbd = quickAddRow.locator('kbd').first()
    await kbd.click()
    await page.waitForTimeout(300)

    // Should show "Press a key..." prompt
    await expect(settingsDialog.locator('text=Press a key...')).toBeVisible()

    // Cancel by pressing Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // "Press a key..." should be gone
    await expect(settingsDialog.locator('text=Press a key...')).not.toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('can change a shortcut and verify it works', async () => {
    await closeDialogs()
    await page.keyboard.press('Control+,')
    await page.waitForTimeout(500)

    const settingsDialog = page.locator('.fixed.inset-0').last()

    // Find "Toggle sidebar" and remap it from 'm' to 'b'
    const sidebarRow = settingsDialog.locator('div:has(> span:text-is("Toggle sidebar"))')
    const kbd = sidebarRow.locator('kbd').first()
    await kbd.click()
    await page.waitForTimeout(300)

    // Press 'b' as new binding
    await page.keyboard.press('b')
    await page.waitForTimeout(300)

    // The kbd should now show 'B' instead of 'M'
    const updatedKbd = sidebarRow.locator('kbd').first()
    await expect(updatedKbd).toHaveText('B')

    // Should show reset icon for overridden shortcut
    const resetButton = sidebarRow.locator('button[title="Reset to default"]')
    await expect(resetButton).toBeVisible()

    // Close settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Verify old shortcut 'm' no longer toggles sidebar
    await blurActive()
    const sidebarBefore = await page.locator('aside').first().isVisible().catch(() => false)

    await page.keyboard.press('m')
    await page.waitForTimeout(300)
    const sidebarAfterM = await page.locator('aside').first().isVisible().catch(() => false)
    expect(sidebarAfterM).toBe(sidebarBefore) // Should not have changed

    // Verify new shortcut 'b' toggles sidebar
    await page.keyboard.press('b')
    await page.waitForTimeout(300)
    const sidebarAfterB = await page.locator('aside').first().isVisible().catch(() => false)
    expect(sidebarAfterB).not.toBe(sidebarBefore) // Should have toggled

    // Toggle back so sidebar is visible for other tests
    if (!sidebarAfterB) {
      await page.keyboard.press('b')
      await page.waitForTimeout(300)
    }
  })

  test('can reset a shortcut to default', async () => {
    await closeDialogs()
    await page.keyboard.press('Control+,')
    await page.waitForTimeout(500)

    const settingsDialog = page.locator('.fixed.inset-0').last()

    // The "Toggle sidebar" row should show the overridden binding from previous test
    const sidebarRow = settingsDialog.locator('div:has(> span:text-is("Toggle sidebar"))')
    const resetButton = sidebarRow.locator('button[title="Reset to default"]')

    // Click reset
    await resetButton.click()
    await page.waitForTimeout(300)

    // The kbd should be back to 'M'
    const kbd = sidebarRow.locator('kbd').first()
    await expect(kbd).toHaveText('M')

    // Reset button should be gone
    await expect(resetButton).not.toBeVisible()

    // Close settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Verify 'm' works again
    await blurActive()
    const sidebarBefore = await page.locator('aside').first().isVisible().catch(() => false)
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
    const sidebarAfterM = await page.locator('aside').first().isVisible().catch(() => false)
    expect(sidebarAfterM).not.toBe(sidebarBefore)

    // Restore sidebar visibility
    if (!sidebarAfterM) {
      await page.keyboard.press('m')
      await page.waitForTimeout(300)
    }
  })

  test('shows conflict warning when assigning duplicate binding', async () => {
    await closeDialogs()
    await page.keyboard.press('Control+,')
    await page.waitForTimeout(500)

    const settingsDialog = page.locator('.fixed.inset-0').last()

    // Remap "Toggle sidebar" to '/' which conflicts with "Search"
    const sidebarRow = settingsDialog.locator('div:has(> span:text-is("Toggle sidebar"))')
    const kbd = sidebarRow.locator('kbd').first()
    await kbd.click()
    await page.waitForTimeout(300)

    await page.keyboard.press('/')
    await page.waitForTimeout(300)

    // Should show conflict warning
    await expect(settingsDialog.locator('text=conflicting bindings')).toBeVisible()

    // Reset to fix the conflict
    const resetButton = sidebarRow.locator('button[title="Reset to default"]')
    await resetButton.click()
    await page.waitForTimeout(300)

    // Warning should be gone
    await expect(settingsDialog.locator('text=conflicting bindings')).not.toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('reset all button clears all overrides', async () => {
    await closeDialogs()
    await page.keyboard.press('Control+,')
    await page.waitForTimeout(500)

    const settingsDialog = page.locator('.fixed.inset-0').last()

    // Make an override first
    const searchRow = settingsDialog.locator('div:has(> span:text-is("Search"))')
    const searchKbd = searchRow.locator('kbd').first()
    await searchKbd.click()
    await page.waitForTimeout(300)
    await page.keyboard.press('F3')
    await page.waitForTimeout(300)

    // "Reset all" button should be visible
    const resetAllButton = settingsDialog.locator('text=Reset all to defaults')
    await expect(resetAllButton).toBeVisible()

    // Click reset all
    await resetAllButton.click()
    await page.waitForTimeout(300)

    // Override should be removed - search should show '/'
    const searchKbdAfter = searchRow.locator('kbd').first()
    await expect(searchKbdAfter).toHaveText('/')

    // "Reset all" should be hidden now
    await expect(resetAllButton).not.toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })
})

test.describe('Default shortcuts still work', () => {
  test('q opens quick add modal', async () => {
    await goToToday()
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const quickAddModal = page.locator('input[placeholder*="Task name"]').first()
    await expect(quickAddModal).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('/ navigates to search', async () => {
    await goToToday()
    await page.keyboard.press('/')
    await page.waitForTimeout(500)

    // Search view should be visible
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
  })
})

test('no console errors', () => {
  const realErrors = consoleErrors.filter(
    (e) => !e.includes('Electron Security Warning') && !e.includes('DevTools')
  )
  expect(realErrors).toEqual([])
})
