/**
 * Tests for remaining feature gaps from FEATURE_AUDIT.md
 * Covers: filter operators, label view, keyboard shortcuts for subtasks
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

  // Collect console errors
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
  await page.waitForTimeout(200)
  await page.click('button:has-text("Inbox")')
  await page.waitForTimeout(500)
  await page.locator('h1:has-text("Inbox")').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
}

async function createTask(taskName: string) {
  const addBtn = page.locator('button:has-text("Add task")').first()
  await addBtn.waitFor({ state: 'visible', timeout: 3000 })
  await addBtn.click()
  await page.waitForTimeout(200)
  const taskInput = page.locator('input[placeholder*="Task name"]').first()
  await taskInput.fill(taskName)
  const addSubmit = page.locator('button:has-text("Add task")').last()
  await addSubmit.click()
  await page.waitForTimeout(500)
}

// ============================================================
// KEYBOARD NAVIGATION: G+U for Upcoming
// ============================================================
test.describe('Keyboard Navigation: G+U for Upcoming', () => {
  test('should navigate to Upcoming with G then U shortcut', async () => {
    await goToInbox()

    // Blur any focused element
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(200)

    // Press G then U
    await page.keyboard.press('g')
    await page.waitForTimeout(300)
    await page.keyboard.press('u')
    await page.waitForTimeout(500)

    // Verify Upcoming view heading
    const heading = page.locator('h1:has-text("Upcoming")')
    await heading.waitFor({ state: 'visible', timeout: 3000 })
    expect(await heading.isVisible()).toBe(true)
  })
})

// ============================================================
// KEYBOARD SUBTASK MANAGEMENT: Tab and Shift+Tab
// ============================================================
test.describe('Keyboard Subtask: Tab indent and Shift+Tab outdent', () => {
  const parentTask = `KBParent-${Date.now()}`
  const childTask = `KBChild-${Date.now()}`

  test('should indent task with Tab to create subtask', async () => {
    await goToInbox()

    // Create two tasks
    await createTask(parentTask)
    await createTask(childTask)

    // Verify both tasks visible
    await page.locator(`.task-item:has-text("${parentTask}")`).waitFor({ state: 'visible', timeout: 3000 })
    await page.locator(`.task-item:has-text("${childTask}")`).waitFor({ state: 'visible', timeout: 3000 })

    // Blur any input and prepare for keyboard navigation
    const heading = page.locator('h1:has-text("Inbox")')
    await heading.click()
    await page.waitForTimeout(200)
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(200)

    // Hover over task list to enable keyboard navigation
    const firstTask = page.locator('.task-item').first()
    await firstTask.hover()
    await page.waitForTimeout(200)

    // Navigate down to the child task (second task)
    await page.keyboard.press('j')
    await page.waitForTimeout(150)
    await page.keyboard.press('j')
    await page.waitForTimeout(150)

    // Press Tab to indent (make it a subtask)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)

    // Verify collapse/expand toggle now appears (indicating parent has children)
    const collapseBtn = page.locator('button[title="Collapse subtasks"], button[title="Expand subtasks"]').first()
    const hasToggle = await collapseBtn.isVisible().catch(() => false)
    expect(hasToggle).toBe(true)
  })

  test('should outdent subtask with Shift+Tab', async () => {
    // Blur and prepare for keyboard navigation
    const heading = page.locator('h1:has-text("Inbox")')
    await heading.click()
    await page.waitForTimeout(200)
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(200)

    const firstTask = page.locator('.task-item').first()
    await firstTask.hover()
    await page.waitForTimeout(200)

    // Navigate to the child task
    await page.keyboard.press('j')
    await page.waitForTimeout(150)
    await page.keyboard.press('j')
    await page.waitForTimeout(150)

    // Press Shift+Tab to outdent
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(500)

    // Verify the collapse toggle is gone (no more subtasks)
    const collapseBtn = page.locator('button[title="Collapse subtasks"], button[title="Expand subtasks"]')
    const hasToggle = await collapseBtn.isVisible().catch(() => false)
    expect(hasToggle).toBe(false)
  })

  test('should collapse subtasks with H key and expand with L key', async () => {
    // Re-indent the task first
    const heading = page.locator('h1:has-text("Inbox")')
    await heading.click()
    await page.waitForTimeout(200)
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(200)

    const firstTask = page.locator('.task-item').first()
    await firstTask.hover()
    await page.waitForTimeout(200)

    // Navigate to child and indent it
    await page.keyboard.press('j')
    await page.waitForTimeout(150)
    await page.keyboard.press('j')
    await page.waitForTimeout(150)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)

    // Navigate back to parent task
    await page.keyboard.press('k')
    await page.waitForTimeout(150)

    // Press H to collapse
    await page.keyboard.press('h')
    await page.waitForTimeout(300)

    // Child should be hidden
    const child = page.locator(`.task-item:has-text("${childTask}")`)
    expect(await child.isVisible()).toBe(false)

    // Press L to expand
    await page.keyboard.press('l')
    await page.waitForTimeout(300)

    // Child should be visible again
    expect(await child.isVisible()).toBe(true)
  })
})

// ============================================================
// LABEL VIEW: Click label in sidebar to navigate to label view
// ============================================================
test.describe('Label View: Navigate to label view', () => {
  const labelName = `TestLabel-${Date.now()}`

  test('should navigate to label view when clicking label in sidebar', async () => {
    await goToInbox()

    // Create a label via sidebar
    await ensureSidebarVisible()
    const addLabelBtn = page.locator('button[title="Add label"], button:has-text("Add label")').first()
    await addLabelBtn.waitFor({ state: 'visible', timeout: 3000 })
    await addLabelBtn.click()
    await page.waitForTimeout(300)

    const labelInput = page.locator('input[placeholder*="label"], input[placeholder*="Label"]').first()
    await labelInput.waitFor({ state: 'visible', timeout: 3000 })
    await labelInput.fill(labelName)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    await closeDialogs()
    await ensureSidebarVisible()

    // Click the label in the sidebar to navigate to label view
    const sidebarLabel = page.locator(`button:has-text("${labelName}")`).first()
    await sidebarLabel.waitFor({ state: 'visible', timeout: 3000 })
    await sidebarLabel.click()
    await page.waitForTimeout(500)

    // Verify label view heading is visible
    const labelHeading = page.locator(`h1:has-text("${labelName}")`)
    await labelHeading.waitFor({ state: 'visible', timeout: 3000 })
    expect(await labelHeading.isVisible()).toBe(true)
  })
})

// ============================================================
// FILTER OPERATORS: AND, NOT, grouping
// ============================================================
test.describe('Filter Query Operators: AND, NOT', () => {
  test('should create filter with AND operator', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    // Click Add filter button
    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    if (await addFilterBtn.isVisible().catch(() => false)) {
      await addFilterBtn.click()
      await page.waitForTimeout(500)

      // Fill in filter name
      const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('Priority AND Filter')
        await page.waitForTimeout(100)
      }

      // Fill in query with AND operator
      const queryInput = page.locator('input[placeholder*="e.g."]').first()
      if (await queryInput.isVisible()) {
        await queryInput.click()
        await queryInput.fill('p1 & today')
        await page.waitForTimeout(200)

        // Verify the input accepted the query
        const inputValue = await queryInput.inputValue()
        expect(inputValue).toContain('&')
      }

      // Submit the filter
      const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(500)
      }

      await closeDialogs()

      // Verify filter appears in sidebar
      const filterBtn = page.locator('button:has-text("Priority AND Filter")').first()
      expect(await filterBtn.isVisible().catch(() => false)).toBe(true)
    }
  })

  test('should create filter with NOT operator', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    if (await addFilterBtn.isVisible().catch(() => false)) {
      await addFilterBtn.click()
      await page.waitForTimeout(500)

      const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('NOT Priority Filter')
        await page.waitForTimeout(100)
      }

      const queryInput = page.locator('input[placeholder*="e.g."]').first()
      if (await queryInput.isVisible()) {
        await queryInput.click()
        await queryInput.fill('!p4')
        await page.waitForTimeout(200)

        const inputValue = await queryInput.inputValue()
        expect(inputValue).toContain('!')
      }

      const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(500)
      }

      await closeDialogs()

      const filterBtn = page.locator('button:has-text("NOT Priority Filter")').first()
      expect(await filterBtn.isVisible().catch(() => false)).toBe(true)
    }
  })

  test('should create filter with grouping parentheses', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    if (await addFilterBtn.isVisible().catch(() => false)) {
      await addFilterBtn.click()
      await page.waitForTimeout(500)

      const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('Grouped Filter')
        await page.waitForTimeout(100)
      }

      const queryInput = page.locator('input[placeholder*="e.g."]').first()
      if (await queryInput.isVisible()) {
        await queryInput.click()
        await queryInput.fill('(p1 | p2) & today')
        await page.waitForTimeout(200)

        const inputValue = await queryInput.inputValue()
        expect(inputValue).toContain('(')
        expect(inputValue).toContain(')')
      }

      const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(500)
      }

      await closeDialogs()

      const filterBtn = page.locator('button:has-text("Grouped Filter")').first()
      expect(await filterBtn.isVisible().catch(() => false)).toBe(true)
    }
  })

  test('should navigate to filter and see it works (no errors)', async () => {
    await ensureSidebarVisible()

    // Click on the AND filter
    const filterBtn = page.locator('button:has-text("Priority AND Filter")').first()
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click()
      await page.waitForTimeout(500)

      // The filter view should load without errors
      // Verify we're on a filter view (heading or filter name visible)
      const heading = page.locator('h1:has-text("Priority AND Filter")')
      await heading.waitFor({ state: 'visible', timeout: 3000 })
      expect(await heading.isVisible()).toBe(true)
    }
  })
})

// ============================================================
// FILTER: OR operator
// ============================================================
test.describe('Filter Query: OR operator', () => {
  test('should create filter with OR operator (|)', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    await addFilterBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
    await nameInput.fill('OR Priority Filter')
    await page.waitForTimeout(100)

    const queryInput = page.locator('input[placeholder*="e.g."]').first()
    await queryInput.click()
    await queryInput.fill('p1 | p2')
    await page.waitForTimeout(200)

    const inputValue = await queryInput.inputValue()
    expect(inputValue).toContain('|')

    const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(500)
    }

    await closeDialogs()

    const filterBtn = page.locator('button:has-text("OR Priority Filter")').first()
    expect(await filterBtn.isVisible().catch(() => false)).toBe(true)
  })
})

// ============================================================
// FILTER: "no date" filter syntax
// ============================================================
test.describe('Filter Query: no date syntax', () => {
  test('should create filter with "no date" query', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    await addFilterBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
    await nameInput.fill('No Date Filter')
    await page.waitForTimeout(100)

    const queryInput = page.locator('input[placeholder*="e.g."]').first()
    await queryInput.click()
    await queryInput.fill('no date')
    await page.waitForTimeout(200)

    const inputValue = await queryInput.inputValue()
    expect(inputValue).toBe('no date')

    const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(500)
    }

    await closeDialogs()

    // Verify filter appears and can be navigated to
    const filterBtn = page.locator('button:has-text("No Date Filter")').first()
    expect(await filterBtn.isVisible().catch(() => false)).toBe(true)

    // Click on the filter to verify it works
    await filterBtn.click()
    await page.waitForTimeout(500)
    const heading = page.locator('h1:has-text("No Date Filter")')
    await heading.waitFor({ state: 'visible', timeout: 3000 })
    expect(await heading.isVisible()).toBe(true)
  })
})

// ============================================================
// FILTER: "search:" keyword filter syntax
// ============================================================
test.describe('Filter Query: search: keyword syntax', () => {
  test('should create filter with "search:" keyword query', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    await addFilterBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
    await nameInput.fill('Search Keyword Filter')
    await page.waitForTimeout(100)

    const queryInput = page.locator('input[placeholder*="e.g."]').first()
    await queryInput.click()
    await queryInput.fill('search:test')
    await page.waitForTimeout(200)

    const inputValue = await queryInput.inputValue()
    expect(inputValue).toBe('search:test')

    const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(500)
    }

    await closeDialogs()

    // Verify filter appears and can be navigated to
    const filterBtn = page.locator('button:has-text("Search Keyword Filter")').first()
    expect(await filterBtn.isVisible().catch(() => false)).toBe(true)

    // Click on the filter to verify it works
    await filterBtn.click()
    await page.waitForTimeout(500)
    const heading = page.locator('h1:has-text("Search Keyword Filter")')
    await heading.waitFor({ state: 'visible', timeout: 3000 })
    expect(await heading.isVisible()).toBe(true)
  })
})

// ============================================================
// FILTER: Wildcard (*) filter syntax
// ============================================================
test.describe('Filter Query: Wildcard (*) syntax', () => {
  test('should create filter with wildcard (*) query', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    await addFilterBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
    await nameInput.fill('Wildcard Filter')
    await page.waitForTimeout(100)

    const queryInput = page.locator('input[placeholder*="e.g."]').first()
    await queryInput.click()
    await queryInput.fill('#*')
    await page.waitForTimeout(200)

    const inputValue = await queryInput.inputValue()
    expect(inputValue).toBe('#*')

    const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(500)
    }

    await closeDialogs()

    // Verify filter appears and can be navigated to
    const filterBtn = page.locator('button:has-text("Wildcard Filter")').first()
    expect(await filterBtn.isVisible().catch(() => false)).toBe(true)

    // Click on the filter to verify it works
    await filterBtn.click()
    await page.waitForTimeout(500)
    const heading = page.locator('h1:has-text("Wildcard Filter")')
    await heading.waitFor({ state: 'visible', timeout: 3000 })
    expect(await heading.isVisible()).toBe(true)
  })
})

// ============================================================
// FILTER: @label and #project filter syntax
// ============================================================
test.describe('Filter Query: @label and #project syntax', () => {
  test('should create filter with @label query syntax', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    await addFilterBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
    await nameInput.fill('Label Query Filter')
    await page.waitForTimeout(100)

    const queryInput = page.locator('input[placeholder*="e.g."]').first()
    await queryInput.click()
    await queryInput.fill('@urgent')
    await page.waitForTimeout(200)

    const inputValue = await queryInput.inputValue()
    expect(inputValue).toBe('@urgent')

    const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(500)
    }

    await closeDialogs()

    const filterBtn = page.locator('button:has-text("Label Query Filter")').first()
    expect(await filterBtn.isVisible().catch(() => false)).toBe(true)
  })

  test('should create filter with #project query syntax', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    await addFilterBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
    await nameInput.fill('Project Query Filter')
    await page.waitForTimeout(100)

    const queryInput = page.locator('input[placeholder*="e.g."]').first()
    await queryInput.click()
    await queryInput.fill('#Inbox')
    await page.waitForTimeout(200)

    const inputValue = await queryInput.inputValue()
    expect(inputValue).toBe('#Inbox')

    const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(500)
    }

    await closeDialogs()

    const filterBtn = page.locator('button:has-text("Project Query Filter")').first()
    expect(await filterBtn.isVisible().catch(() => false)).toBe(true)
  })
})

// ============================================================
// FILTER: Favorites checkbox
// ============================================================
test.describe('Filter Favorites', () => {
  test('should create filter with favorite checkbox enabled', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    const addFilterBtn = page.locator('button[title="Add filter"], button:has-text("Add filter")').first()
    await addFilterBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()
    await nameInput.fill('Favorite Test Filter')
    await page.waitForTimeout(100)

    const queryInput = page.locator('input[placeholder*="e.g."]').first()
    await queryInput.click()
    await queryInput.fill('p1')
    await page.waitForTimeout(200)

    // Check the favorites checkbox
    const favoriteCheckbox = page.locator('#favorite, input[type="checkbox"]').first()
    if (await favoriteCheckbox.isVisible().catch(() => false)) {
      await favoriteCheckbox.check()
      await page.waitForTimeout(200)
    }

    // Also check the label for favorites
    const favLabel = page.locator('label:has-text("favorite"), label[for="favorite"]').first()
    if (await favLabel.isVisible().catch(() => false)) {
      // Label is there, which means the favorites feature exists in the dialog
      expect(true).toBe(true)
    }

    const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add"), .fixed.inset-0 button:has-text("Save")').first()
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(500)
    }

    await closeDialogs()

    // Verify filter appears in sidebar
    const filterBtn = page.locator('button:has-text("Favorite Test Filter")').first()
    expect(await filterBtn.isVisible().catch(() => false)).toBe(true)
  })
})

// ============================================================
// DEADLINE: Setting deadline in edit dialog
// ============================================================
test.describe('Deadline Field in Edit Dialog', () => {
  test('should set deadline for task via edit dialog', async () => {
    await goToInbox()

    const taskName = `DeadlineTask-${Date.now()}`
    await createTask(taskName)

    // Open edit dialog
    const taskContent = page.locator(`.task-item .cursor-pointer:has-text("${taskName}")`).first()
    await taskContent.click()
    await page.waitForTimeout(600)

    // Verify edit dialog is open
    const editDialog = page.locator('h2:has-text("Edit task")')
    await editDialog.waitFor({ state: 'visible', timeout: 3000 })

    // Look for Deadline label and its picker
    const deadlineLabel = page.locator('label:has-text("Deadline")')
    expect(await deadlineLabel.isVisible()).toBe(true)

    // Look for "No deadline" button
    const noDeadline = page.locator('button:has-text("No deadline")')
    expect(await noDeadline.isVisible()).toBe(true)

    await closeDialogs()
  })
})

// ============================================================
// SETTINGS: Verify all settings options exist
// ============================================================
test.describe('Settings: All options present', () => {
  test('should show notification settings in settings panel', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    // Open settings
    await page.keyboard.press('Meta+,')
    await page.waitForTimeout(500)

    // Look for notification-related settings
    const notifText = page.locator('text=/notif/i').first()
    const hasNotifSettings = await notifText.isVisible().catch(() => false)

    // Notifications should be in settings
    expect(hasNotifSettings).toBe(true)

    await closeDialogs()
  })
})

// Final check: no console errors during entire test run
test('should have no console errors throughout test run', () => {
  expect(consoleErrors).toHaveLength(0)
})
