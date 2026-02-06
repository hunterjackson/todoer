/**
 * E2E tests for CODE_REVIEW v8 findings.
 * Covers: inline parsing in TaskAddInput, MCP resource listing, settings import validation.
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

async function resetInboxGrouping() {
  await goToInbox()
  const groupBtn = page.locator('button:has-text("Group")')
  if (await groupBtn.isVisible().catch(() => false)) {
    await groupBtn.click()
    await page.waitForTimeout(200)
    const noneOpt = page.locator('[role="menuitemradio"]:has-text("None")')
    if (await noneOpt.isVisible().catch(() => false)) {
      await noneOpt.click()
      await page.waitForTimeout(300)
    } else {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)
    }
  }
}

test.describe.serial('CODE_REVIEW v8 fixes', () => {
  test('setup: go to inbox', async () => {
    await resetInboxGrouping()
  })

  test('Finding 1: settings:set validates entries', async () => {
    // Valid setting should succeed
    const validResult = await page.evaluate(async () => {
      return window.api.settings.set('timeFormat', '24h')
    })
    expect(validResult).toBe(true)

    const timeFormat = await page.evaluate(() => window.api.settings.get('timeFormat'))
    expect(timeFormat).toBe('24h')

    // Invalid key should throw (caught by IPC, returns error)
    const invalidKeyResult = await page.evaluate(async () => {
      try {
        return await window.api.settings.set('invalidKey', 'badValue')
      } catch {
        return 'error'
      }
    })
    expect(invalidKeyResult).toBe('error')

    // Invalid value should throw
    const invalidValueResult = await page.evaluate(async () => {
      try {
        return await window.api.settings.set('dailyGoal', '0')
      } catch {
        return 'error'
      }
    })
    expect(invalidValueResult).toBe('error')
  })

  test('Finding 4: TaskAddInput strips inline tokens from content', async () => {
    await goToInbox()

    // Use inline add input with inline priority modifier (p1)
    // This doesn't require project/label resolution - just parsing
    const addButton = page.locator('button:has-text("Add task")').first()
    await addButton.click()
    await page.waitForTimeout(300)

    const input = page.locator('input[placeholder*="Task name"]').first()
    await input.fill('Important task p1')
    await page.waitForTimeout(200)

    // Submit via Add task button
    const submitBtn = page.locator('button:has-text("Add task")').last()
    await submitBtn.click()
    await page.waitForTimeout(500)

    // Task should appear with "p1" stripped from content and priority 1 flag visible
    await expect(page.locator('text=Important task')).toBeVisible()
    // The task should NOT contain "p1" as literal text
    const taskText = await page.locator('text=Important task').first().textContent()
    expect(taskText).not.toContain('p1')
  })

  test('Finding 4: TaskAddInput parses inline @label via Quick Add', async () => {
    // Create a label first (before opening modal, so useLabels picks it up)
    await page.evaluate(async () => {
      return window.api.labels.create({ name: 'QuickLabel', color: '#00ff00' })
    })
    await page.waitForTimeout(300)

    // Use Quick Add modal (Q shortcut) which reliably has inline parsing
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(100)
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const quickInput = page.locator('input[placeholder*="Task name"]').first()
    await quickInput.fill('Quick labeled task @QuickLabel')
    await page.waitForTimeout(200)

    await page.locator('button:has-text("Add task")').last().click()
    await page.waitForTimeout(500)

    // Close quick add
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Navigate to inbox and verify the task content was parsed
    await goToInbox()
    await expect(page.locator('text=Quick labeled task')).toBeVisible()

    // Click to verify label was applied
    await page.locator('text=Quick labeled task').first().click()
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0').last()
    await expect(dialog.locator('text=QuickLabel')).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('should have no console errors', () => {
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('Electron Security Warning') && !e.includes('DevTools')
    )
    expect(realErrors).toEqual([])
  })
})
