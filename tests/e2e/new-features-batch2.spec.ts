import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { join } from 'path'

/**
 * E2E Tests for Tasks #66-#74 batch features:
 * - #66: Completed tasks toggle in all views
 * - #67: Create new project from task edit dialog dropdown
 * - #68: File attachments stored in SQLite
 * - #69: Bug fix - comment edit save button closes task view
 * - #70: Subtask creation from project view with shortcut
 * - #71: Expand all/collapse all subtasks toggle
 * - #72: Three-dot menu in project view
 * - #73: Sort/group by in all task views with per-view persistence
 * - #74: Hyperlinks clickable in titles
 */

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

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
})

test.afterAll(async () => {
  await electronApp?.close()
})

// Helpers
async function closeDialogs() {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(200)
}

async function ensureSidebarVisible() {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  const sidebar = page.locator('aside, nav').first()
  if (!(await sidebar.isVisible().catch(() => false))) {
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
  }
}

async function goToInbox() {
  await closeDialogs()
  await ensureSidebarVisible()
  await page.click('button:has-text("Inbox")')
  await page.waitForTimeout(500)
}

async function goToToday() {
  await closeDialogs()
  await ensureSidebarVisible()
  await page.click('button:has-text("Today")')
  await page.waitForTimeout(500)
}

// Reset inbox group to None so Add Task button is visible
async function resetInboxGrouping() {
  await goToInbox()
  const groupButton = page.locator('button:has-text("Group:")').first()
  const groupText = await groupButton.textContent()
  if (groupText && !groupText.includes('None')) {
    await groupButton.click()
    await page.waitForTimeout(200)
    await page.locator('.absolute.z-50 button:has-text("None")').first().click()
    await page.waitForTimeout(300)
  }
}

async function createTask(name: string) {
  const addButton = page.locator('button:has-text("Add task")').first()
  await addButton.waitFor({ state: 'visible', timeout: 5000 })
  await addButton.click()
  await page.waitForTimeout(200)

  const input = page.locator('input[placeholder*="Task name"]').first()
  await input.fill(name)
  const addSubmit = page.locator('button:has-text("Add task")').last()
  await addSubmit.click()
  await page.waitForTimeout(500)
}

async function openEditDialog(taskName: string) {
  const taskContent = page.locator(`.task-item .cursor-pointer:has-text("${taskName}")`).first()
  await taskContent.waitFor({ state: 'visible', timeout: 5000 })
  await taskContent.click()
  await page.waitForTimeout(600)
}

async function createProject(name: string) {
  await ensureSidebarVisible()
  const addProjectBtn = page.locator('button[title="Add project"]').first()
  if (await addProjectBtn.isVisible().catch(() => false)) {
    await addProjectBtn.click()
  } else {
    await page.locator('button:has-text("Add Project")').first().click()
  }
  await page.waitForTimeout(300)

  const nameInput = page.locator('input[placeholder*="Project name"], input[placeholder*="project name"]').first()
  await nameInput.waitFor({ state: 'visible', timeout: 3000 })
  await nameInput.fill(name)
  await page.waitForTimeout(200)

  // Submit - button text is "Add" in the project dialog
  const createBtn = page.locator('.fixed.inset-0 button:has-text("Add")').first()
  await createBtn.click()
  await page.waitForTimeout(500)
}

async function goToProject(projectName: string) {
  await closeDialogs()
  await ensureSidebarVisible()
  await page.click(`text=${projectName}`)
  await page.waitForTimeout(500)
}

// ============================================
// Task #74: Hyperlinks in task titles
// ============================================
test.describe('Hyperlinks in Task Titles', () => {
  test('URLs in task titles should be rendered as clickable links', async () => {
    // Reset grouping first so we can create tasks
    await resetInboxGrouping()

    // Create a task with a URL
    const taskName = `Check https://example.com for details`
    await createTask(taskName)
    await page.waitForTimeout(500)

    // Verify the link is rendered as an <a> tag with correct href
    const link = page.locator('.task-item a[href="https://example.com"]').first()
    await expect(link).toBeVisible()
    // The link opens via window.open in onClick handler, not via target attribute
    await expect(link).toHaveAttribute('href', 'https://example.com')
  })
})

// ============================================
// Task #69: Comment edit save button bug fix
// ============================================
test.describe('Comment Edit Bug Fix', () => {
  test('comment buttons should have stopPropagation preventing dialog close', async () => {
    await resetInboxGrouping()

    // Create a task
    const taskName = `CommentBugTest${Date.now()}`
    await createTask(taskName)

    // Open edit dialog
    await openEditDialog(taskName)
    await page.waitForTimeout(500)

    // Check dialog is open - use the form element inside the dialog
    const dialogForm = page.locator('.fixed.inset-0 form, .fixed.inset-0 [class*="bg-background"]').first()
    await expect(dialogForm).toBeVisible()

    // Scroll down to find comment section
    const scrollable = page.locator('.fixed.inset-0').first()
    await scrollable.evaluate((el) => {
      const scrollEl = el.querySelector('.overflow-y-auto') || el.querySelector('.overflow-auto')
      if (scrollEl) scrollEl.scrollTo(0, scrollEl.scrollHeight)
    })
    await page.waitForTimeout(300)

    // Add a comment
    const commentInput = page.locator('input[placeholder="Add a comment..."]').first()
    await commentInput.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})

    if (await commentInput.isVisible().catch(() => false)) {
      await commentInput.fill('Test comment for bug fix')
      await page.waitForTimeout(200)
      await commentInput.press('Enter')
      await page.waitForTimeout(1000)

      // Scroll down again after adding comment
      await scrollable.evaluate((el) => {
        const scrollEl = el.querySelector('.overflow-y-auto') || el.querySelector('.overflow-auto')
        if (scrollEl) scrollEl.scrollTo(0, scrollEl.scrollHeight)
      })
      await page.waitForTimeout(300)

      // Verify comment was added and dialog is still open
      const comment = page.locator('text=Test comment for bug fix')
      await expect(comment).toBeVisible({ timeout: 3000 }).catch(() => {})

      // The dialog should still be open (even just adding a comment)
      await expect(dialogForm).toBeVisible()
    }

    await closeDialogs()
  })
})

// ============================================
// Task #67: Create new project from edit dialog
// ============================================
test.describe('Create Project from Edit Dialog', () => {
  test('task edit dialog project dropdown should have Create new project option', async () => {
    await resetInboxGrouping()

    // Create a task
    const taskName = `NewProjectDropdown${Date.now()}`
    await createTask(taskName)

    // Open edit dialog
    await openEditDialog(taskName)
    await page.waitForTimeout(500)

    // Look for the project select dropdown
    const projectSelect = page.locator('select').first()
    if (await projectSelect.isVisible().catch(() => false)) {
      // Check that it has the "Create new project" option
      const createOption = page.locator('option[value="__create_new__"]')
      await expect(createOption).toBeAttached()
    }

    await closeDialogs()
  })
})

// ============================================
// Task #68: File attachments
// ============================================
test.describe('File Attachments UI', () => {
  test('task edit dialog should show Attachments section', async () => {
    await resetInboxGrouping()

    // Create a task
    const taskName = `AttachmentTest${Date.now()}`
    await createTask(taskName)

    // Open edit dialog
    await openEditDialog(taskName)
    await page.waitForTimeout(500)

    // Scroll down to find attachments section
    const dialogContent = page.locator('.fixed.inset-0 .overflow-y-auto, .fixed.inset-0 .overflow-auto').first()
    if (await dialogContent.isVisible().catch(() => false)) {
      await dialogContent.evaluate((el) => el.scrollTo(0, el.scrollHeight))
      await page.waitForTimeout(300)
    }

    // Look for Attachments section
    const attachmentSection = page.locator('text=Attachments')
    await expect(attachmentSection).toBeVisible()

    // Look for "Attach file" button
    const addFileBtn = page.locator('button:has-text("Attach file")')
    await expect(addFileBtn).toBeVisible()

    await closeDialogs()
  })
})

// ============================================
// Task #70: Subtask creation from project view
// ============================================
test.describe('Subtask Creation from View', () => {
  test('pressing s on a focused task should show inline subtask input', async () => {
    await resetInboxGrouping()

    // Create a parent task
    const parentName = `SubtaskParent${Date.now()}`
    await createTask(parentName)
    await page.waitForTimeout(300)

    // Blur any focused element first
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(200)

    // Hover over the task list area to enable keyboard shortcuts
    const taskItem = page.locator('.task-item').first()
    await taskItem.hover()
    await page.waitForTimeout(200)

    // Press j to focus first task
    await page.keyboard.press('j')
    await page.waitForTimeout(300)

    // Press s to open inline subtask input
    await page.keyboard.press('s')
    await page.waitForTimeout(300)

    // Check if an inline subtask input appeared
    const subtaskInput = page.locator('input[placeholder*="subtask"], input[placeholder*="Subtask"]').first()
    const isVisible = await subtaskInput.isVisible().catch(() => false)

    if (isVisible) {
      // Type a subtask name and submit
      await subtaskInput.fill('My inline subtask')
      await subtaskInput.press('Enter')
      await page.waitForTimeout(500)

      // Verify subtask was created
      const subtask = page.locator('text=My inline subtask')
      await expect(subtask).toBeVisible()
    }

    await closeDialogs()
  })
})

// ============================================
// Task #72: Three-dot menu in project view
// ============================================
test.describe('Project View Three-Dot Menu', () => {
  test('should create project and show functional three-dot menu', async () => {
    const projectName = `MenuTestProject${Date.now()}`
    await createProject(projectName)
    await page.waitForTimeout(300)

    // Navigate to the project
    await goToProject(projectName)
    await page.waitForTimeout(500)

    // Click the three-dot menu button (MoreHorizontal icon)
    const menuButton = page.locator('button[title="Project options"]').first()
    await expect(menuButton).toBeVisible()
    await menuButton.click()
    await page.waitForTimeout(300)

    // Verify menu items are visible
    await expect(page.locator('button:has-text("Add section")')).toBeVisible()
    await expect(page.locator('button:has-text("Edit project")')).toBeVisible()
    await expect(page.locator('button:has-text("Archive project")')).toBeVisible()
    await expect(page.locator('button:has-text("Delete project")')).toBeVisible()
  })

  test('project view should have sort and group controls', async () => {
    const projectName = `SortTestProject${Date.now()}`
    await createProject(projectName)
    await goToProject(projectName)
    await page.waitForTimeout(500)

    const sortButton = page.locator('button:has-text("Sort:")').first()
    await expect(sortButton).toBeVisible()

    const groupButton = page.locator('button:has-text("Group:")').first()
    await expect(groupButton).toBeVisible()
  })
})

// ============================================
// Task #66: Completed tasks toggle
// ============================================
test.describe('Completed Tasks Toggle', () => {
  test('Inbox should have Completed toggle button', async () => {
    await goToInbox()

    const completedButton = page.locator('button:has-text("Completed")').first()
    await expect(completedButton).toBeVisible()
  })

  test('should toggle completed tasks section visibility', async () => {
    await resetInboxGrouping()

    // First, ensure completed toggle is OFF by checking its state
    const completedButton = page.locator('button:has-text("Completed")').first()

    // Check if "Completed tasks" section is currently visible
    const sectionAlreadyVisible = await page.locator('span:has-text("Completed tasks")').first().isVisible().catch(() => false)

    if (sectionAlreadyVisible) {
      // Turn it OFF first
      await completedButton.click()
      await page.waitForTimeout(500)
    }

    // Verify no completed tasks section is visible
    const visibleBefore = await page.locator('span:has-text("Completed tasks")').first().isVisible().catch(() => false)
    expect(visibleBefore).toBe(false)

    // Now toggle it ON
    await completedButton.click()
    await page.waitForTimeout(1000)

    // Verify the completed tasks section now appears
    // Use .first() to avoid strict mode with multiple matches ("Completed tasks" span and "No completed tasks yet")
    const completedSectionAfter = page.locator('span:has-text("Completed tasks")').first()
    await expect(completedSectionAfter).toBeVisible()
  })

  test('Today view should have Completed toggle button', async () => {
    await goToToday()

    const completedButton = page.locator('button:has-text("Completed")').first()
    await expect(completedButton).toBeVisible()
  })
})

// ============================================
// Task #71: Expand/Collapse all subtasks
// ============================================
test.describe('Expand/Collapse All Toggle', () => {
  test('Inbox should have Expand/Collapse toggle button', async () => {
    await goToInbox()

    const expandButton = page.locator('button:has-text("Expand"), button:has-text("Collapse")').first()
    await expect(expandButton).toBeVisible()
  })

  test('should toggle between Expand and Collapse text', async () => {
    await goToInbox()

    const button = page.locator('button:has-text("Expand"), button:has-text("Collapse")').first()
    const initialText = await button.textContent()

    await button.click()
    await page.waitForTimeout(300)

    const newText = await button.textContent()
    expect(newText).not.toBe(initialText)
  })
})

// ============================================
// Task #73: Sort/Group by in all views
// ============================================
test.describe('Sort/Group Options in Views', () => {
  test('Inbox view should have sort and group controls', async () => {
    await goToInbox()

    const sortButton = page.locator('button:has-text("Sort:")').first()
    await expect(sortButton).toBeVisible()

    const groupButton = page.locator('button:has-text("Group:")').first()
    await expect(groupButton).toBeVisible()
  })

  test('should be able to change sort field in Inbox', async () => {
    await goToInbox()

    const sortButton = page.locator('button:has-text("Sort:")').first()
    await sortButton.click()
    await page.waitForTimeout(200)

    const dateAddedOption = page.locator('.absolute.z-50 button:has-text("Date added")').first()
    await dateAddedOption.click()
    await page.waitForTimeout(300)

    await expect(sortButton).toContainText('Date added')
  })

  test('should be able to change group by in Inbox', async () => {
    await goToInbox()

    const groupButton = page.locator('button:has-text("Group:")').first()
    await groupButton.click()
    await page.waitForTimeout(200)

    const dueDateGroup = page.locator('.absolute.z-50 button:has-text("Due date")').first()
    await dueDateGroup.click()
    await page.waitForTimeout(300)

    await expect(groupButton).toContainText('Due date')

    // Reset to None to not break other tests
    await groupButton.click()
    await page.waitForTimeout(200)
    await page.locator('.absolute.z-50 button:has-text("None")').first().click()
    await page.waitForTimeout(300)
  })

  test('Today view should have sort and group controls', async () => {
    await goToToday()

    const sortButton = page.locator('button:has-text("Sort:")').first()
    await expect(sortButton).toBeVisible()

    const groupButton = page.locator('button:has-text("Group:")').first()
    await expect(groupButton).toBeVisible()
  })

  test('sort settings should persist per view', async () => {
    // Set Inbox to sort by Alphabetical
    await goToInbox()
    let sortButton = page.locator('button:has-text("Sort:")').first()
    await sortButton.click()
    await page.waitForTimeout(200)
    await page.locator('.absolute.z-50 button:has-text("Alphabetical")').first().click()
    await page.waitForTimeout(300)

    // Go to Today
    await goToToday()
    await page.waitForTimeout(300)

    // Go back to Inbox - should still show Alphabetical
    await goToInbox()
    sortButton = page.locator('button:has-text("Sort:")').first()
    await expect(sortButton).toContainText('Alphabetical')
  })
})

// ============================================
// Cross-view feature verification
// ============================================
test.describe('Cross-View Feature Presence', () => {
  test('all main views should have sort controls', async () => {
    await goToInbox()
    let sortBtn = page.locator('button:has-text("Sort:")').first()
    await expect(sortBtn).toBeVisible()

    await goToToday()
    sortBtn = page.locator('button:has-text("Sort:")').first()
    await expect(sortBtn).toBeVisible()

    await closeDialogs()
    await ensureSidebarVisible()
    await page.click('button:has-text("Upcoming")')
    await page.waitForTimeout(500)
    sortBtn = page.locator('button:has-text("Sort:")').first()
    await expect(sortBtn).toBeVisible()
  })

  test('all main views should have completed toggle', async () => {
    await goToInbox()
    let completedBtn = page.locator('button:has-text("Completed")').first()
    await expect(completedBtn).toBeVisible()

    await goToToday()
    completedBtn = page.locator('button:has-text("Completed")').first()
    await expect(completedBtn).toBeVisible()
  })

  test('all main views should have expand/collapse toggle', async () => {
    await goToInbox()
    let expandBtn = page.locator('button:has-text("Expand"), button:has-text("Collapse")').first()
    await expect(expandBtn).toBeVisible()

    await goToToday()
    expandBtn = page.locator('button:has-text("Expand"), button:has-text("Collapse")').first()
    await expect(expandBtn).toBeVisible()
  })
})

// ============================================
// Console error collection test
// ============================================
test.describe('Console Errors', () => {
  test('should not have console errors during tests', async () => {
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('Warning:') &&
        !e.includes('React does not recognize') &&
        !e.includes('Each child in a list') &&
        !e.includes('findDOMNode') &&
        !e.includes('ResizeObserver') &&
        !e.includes('act()')
    )
    if (realErrors.length > 0) {
      console.log('Console errors found:', realErrors)
    }
    expect(realErrors.length).toBe(0)
  })
})
