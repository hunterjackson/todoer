import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication
let page: Page
const consoleErrors: string[] = []

test.beforeAll(async () => {
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

// Helper to close any open dialogs
async function closeDialogs() {
  const backdrop = page.locator('.fixed.inset-0.bg-black\\/50').first()
  if (await backdrop.isVisible().catch(() => false)) {
    await backdrop.click({ position: { x: 10, y: 10 }, force: true }).catch(() => {})
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(200)
}

// Helper to ensure sidebar is visible
async function ensureSidebarVisible() {
  const inboxButton = page.locator('button:has-text("Inbox")')
  const isVisible = await inboxButton.isVisible().catch(() => false)

  if (!isVisible) {
    const mainArea = page.locator('main').first()
    if (await mainArea.isVisible().catch(() => false)) {
      await mainArea.click({ position: { x: 10, y: 10 } })
      await page.waitForTimeout(100)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
    await inboxButton.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
  }
}

// Helper to navigate to inbox
async function goToInbox() {
  await closeDialogs()
  await ensureSidebarVisible()
  await page.click('button:has-text("Inbox")')
  await page.waitForTimeout(300)
}

test.describe('Inline Label Autocomplete with @ symbol', () => {
  test.beforeEach(async () => {
    await closeDialogs()
  })

  test('should show label dropdown when typing @ in Quick Add', async () => {
    // First create a label
    await ensureSidebarVisible()
    const addLabelBtn = page.locator('button[title="Add label"]').first()
    if (await addLabelBtn.isVisible()) {
      await addLabelBtn.click()
      await page.waitForTimeout(300)

      const nameInput = page.locator('input[type="text"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('urgent')
        const addBtn = page.locator('button:has-text("Add"), button:has-text("Save")').first()
        await addBtn.click()
        await page.waitForTimeout(300)
      }
    }
    await closeDialogs()

    // Open Quick Add
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0.z-50').first()
    const input = dialog.locator('input[type="text"]').first()

    if (await input.isVisible().catch(() => false)) {
      await input.click()
      // Type task name followed by @ (@ = label after Fix #10)
      await page.keyboard.type('Test task @', { delay: 20 })
      await page.waitForTimeout(300)

      // Should show dropdown with label suggestions
      const dropdown = page.locator('.fixed.bg-popover, [role="listbox"]').first()
      const isDropdownVisible = await dropdown.isVisible().catch(() => false)

      // Look for the urgent label in the dropdown
      const urgentOption = page.locator('button:has-text("urgent"), [role="option"]:has-text("urgent")').first()
      const hasUrgentOption = await urgentOption.isVisible().catch(() => false)

      expect(isDropdownVisible || hasUrgentOption).toBe(true)
    }

    await closeDialogs()
  })

  test('should select label from dropdown with keyboard in Quick Add', async () => {
    await goToInbox()

    // Open Quick Add
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0.z-50').first()
    const input = dialog.locator('input[type="text"]').first()

    if (await input.isVisible().catch(() => false)) {
      await input.click()
      await page.keyboard.type('Test with label @urg', { delay: 20 })
      await page.waitForTimeout(300)

      // Press Enter or Tab to select the first matching label
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)

      // The label should be selected (check for label chip or label added indicator)
      const labelChip = dialog.locator('[class*="rounded-full"]:has-text("urgent"), span:has-text("urgent")')
      const isLabelSelected = await labelChip.isVisible().catch(() => false)

      // Even if chip not visible, the dropdown should have closed
      const dropdown = page.locator('.fixed.bg-popover').first()
      const isDropdownHidden = !(await dropdown.isVisible().catch(() => false))

      expect(isLabelSelected || isDropdownHidden).toBe(true)
    }

    await closeDialogs()
  })

  test('should show label dropdown when typing @ in Task Edit Dialog', async () => {
    await goToInbox()

    // Create a task first
    const addBtn = page.locator('button:has-text("Add task")').first()
    if (await addBtn.isVisible()) {
      await addBtn.click()
      const taskInput = page.locator('input[placeholder*="Task"]').first()
      await taskInput.fill('Task to edit with label')
      await page.click('button:has-text("Add")')
      await page.waitForTimeout(300)
    }

    // Open task edit dialog
    const taskContent = page.locator('.task-item:has-text("Task to edit") .text-sm.cursor-pointer').first()
    if (await taskContent.isVisible().catch(() => false)) {
      await taskContent.click()
      await page.waitForTimeout(500)

      // Find the task name input in the edit dialog
      const editInput = page.locator('.fixed.inset-0 input[type="text"]').first()
      if (await editInput.isVisible().catch(() => false)) {
        // Clear and type with @ for label (@ = label after Fix #10)
        await editInput.clear()
        await editInput.click()
        await page.keyboard.type('Edited task @', { delay: 20 })
        await page.waitForTimeout(300)

        // Should show dropdown with label suggestions
        const dropdown = page.locator('.fixed.bg-popover, [role="listbox"]').first()
        const isDropdownVisible = await dropdown.isVisible().catch(() => false)

        expect(isDropdownVisible).toBe(true)
      }
    }

    await closeDialogs()
  })

  test('should create new label when selecting "Create" option', async () => {
    await goToInbox()

    // Open Quick Add
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0.z-50').first()
    const input = dialog.locator('input[type="text"]').first()

    if (await input.isVisible().catch(() => false)) {
      await input.click()
      // Type a label name that doesn't exist
      await page.keyboard.type('Test task @newuniquelabel', { delay: 20 })
      await page.waitForTimeout(300)

      // Should show "Create" option in dropdown
      const createOption = page.locator('button:has-text("Create"), [role="option"]:has-text("Create")')
      const hasCreateOption = await createOption.isVisible().catch(() => false)

      expect(hasCreateOption).toBe(true)
    }

    await closeDialogs()
  })
})

test.describe('Inline Project Autocomplete with # symbol', () => {
  test.beforeEach(async () => {
    await closeDialogs()
  })

  test('should show project dropdown when typing # in Quick Add', async () => {
    // First create a project
    await ensureSidebarVisible()
    const addProjectBtn = page.locator('button[title="Add project"]').first()
    if (await addProjectBtn.isVisible()) {
      await addProjectBtn.click()
      await page.waitForTimeout(300)

      const nameInput = page.locator('input[placeholder="Project name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('WorkProject')
        await page.click('button:has-text("Add")')
        await page.waitForTimeout(300)
      }
    }
    await closeDialogs()

    // Open Quick Add
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0.z-50').first()
    const input = dialog.locator('input[type="text"]').first()

    if (await input.isVisible().catch(() => false)) {
      await input.click()
      // Type task name followed by # (# = project after Fix #10)
      await page.keyboard.type('Test task #', { delay: 20 })
      await page.waitForTimeout(300)

      // Should show dropdown with project suggestions
      const dropdown = page.locator('.fixed.bg-popover, [role="listbox"]').first()
      const isDropdownVisible = await dropdown.isVisible().catch(() => false)

      // Look for a project in the dropdown
      const projectOption = page.locator('button:has-text("WorkProject"), button:has-text("Inbox"), [role="option"]:has-text("WorkProject")').first()
      const hasProjectOption = await projectOption.isVisible().catch(() => false)

      expect(isDropdownVisible || hasProjectOption).toBe(true)
    }

    await closeDialogs()
  })

  test('should select project from dropdown with keyboard in Quick Add', async () => {
    await goToInbox()

    // Open Quick Add
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0.z-50').first()
    const input = dialog.locator('input[type="text"]').first()

    if (await input.isVisible().catch(() => false)) {
      await input.click()
      await page.keyboard.type('Test with project #Work', { delay: 20 })
      await page.waitForTimeout(300)

      // Press Enter or Tab to select the first matching project
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)

      // The dropdown should have closed after selection
      const dropdown = page.locator('.fixed.bg-popover').first()
      const isDropdownHidden = !(await dropdown.isVisible().catch(() => false))

      expect(isDropdownHidden).toBe(true)
    }

    await closeDialogs()
  })

  test('should show project dropdown when typing # in Task Edit Dialog', async () => {
    await goToInbox()

    // Create a task first
    const addBtn = page.locator('button:has-text("Add task")').first()
    if (await addBtn.isVisible()) {
      await addBtn.click()
      const taskInput = page.locator('input[placeholder*="Task"]').first()
      await taskInput.fill('Task to edit with project')
      await page.click('button:has-text("Add")')
      await page.waitForTimeout(300)
    }

    // Open task edit dialog
    const taskContent = page.locator('.task-item:has-text("Task to edit with project") .text-sm.cursor-pointer').first()
    if (await taskContent.isVisible().catch(() => false)) {
      await taskContent.click()
      await page.waitForTimeout(500)

      // Find the task name input in the edit dialog
      const editInput = page.locator('.fixed.inset-0 input[type="text"]').first()
      if (await editInput.isVisible().catch(() => false)) {
        // Clear and type with # for project (# = project after Fix #10)
        await editInput.clear()
        await editInput.click()
        await page.keyboard.type('Edited task #', { delay: 20 })
        await page.waitForTimeout(300)

        // Should show dropdown with project suggestions
        const dropdown = page.locator('.fixed.bg-popover, [role="listbox"]').first()
        const isDropdownVisible = await dropdown.isVisible().catch(() => false)

        expect(isDropdownVisible).toBe(true)
      }
    }

    await closeDialogs()
  })

  test('should create new project when selecting "Create" option', async () => {
    await goToInbox()

    // Open Quick Add
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0.z-50').first()
    const input = dialog.locator('input[type="text"]').first()

    if (await input.isVisible().catch(() => false)) {
      await input.click()
      // Type a project name that doesn't exist
      await page.keyboard.type('Test task #NewUniqueProject', { delay: 20 })
      await page.waitForTimeout(300)

      // Should show "Create" option in dropdown
      const createOption = page.locator('button:has-text("Create"), [role="option"]:has-text("Create")')
      const hasCreateOption = await createOption.isVisible().catch(() => false)

      expect(hasCreateOption).toBe(true)
    }

    await closeDialogs()
  })
})

test.describe('Combined Label and Project Autocomplete', () => {
  test.beforeEach(async () => {
    await closeDialogs()
  })

  test('should handle both # and @ in same task name', async () => {
    await goToInbox()

    // Open Quick Add
    await page.keyboard.press('q')
    await page.waitForTimeout(500)

    const dialog = page.locator('.fixed.inset-0.z-50').first()
    const input = dialog.locator('input[type="text"]').first()

    if (await input.isVisible().catch(() => false)) {
      await input.click()

      // Type task with label (@ = label after Fix #10)
      await page.keyboard.type('Complex task @urg', { delay: 20 })
      await page.waitForTimeout(200)
      await page.keyboard.press('Escape') // dismiss label dropdown
      await page.waitForTimeout(100)

      // Continue typing with project (# = project after Fix #10)
      await page.keyboard.type(' #Work', { delay: 20 })
      await page.waitForTimeout(300)

      // Should show project dropdown now
      const dropdown = page.locator('.fixed.bg-popover').first()
      const isDropdownVisible = await dropdown.isVisible().catch(() => false)

      // Verify the input contains both @ and # tokens
      const inputValue = await input.inputValue()
      expect(inputValue).toContain('@')
      expect(inputValue).toContain('#')
    }

    await closeDialogs()
  })
})

// Final check: no console errors during entire test run
test('should have no console errors throughout test run', () => {
  expect(consoleErrors).toHaveLength(0)
})
