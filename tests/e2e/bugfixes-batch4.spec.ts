/**
 * Bug fixes batch 4 - E2E tests
 * #79: Project name squashed by sort/group dropdowns
 * #80: New label from task edit should immediately show in sidebar
 * #81: Subtasks should show in Today view
 * #82: "Group by Project" should not appear in project view
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
  await page.locator('h1:has-text("Inbox")').waitFor({ state: 'visible' }).catch(() => {})
}

async function resetInboxGrouping() {
  const groupBtn = page.locator('button:has-text("Group:")').first()
  if (await groupBtn.isVisible().catch(() => false)) {
    const btnText = await groupBtn.textContent()
    if (btnText && !btnText.includes('None')) {
      await groupBtn.click()
      await page.waitForTimeout(200)
      const noneOption = page.locator('[role="menuitem"]:has-text("None"), button:has-text("None")').first()
      if (await noneOption.isVisible().catch(() => false)) {
        await noneOption.click()
        await page.waitForTimeout(300)
      } else {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(200)
      }
    }
  }
}

async function createTask(taskName: string) {
  await resetInboxGrouping()
  const addBtn = page.locator('button:has-text("Add task")').first()
  await addBtn.waitFor({ state: 'visible' })
  await addBtn.click()
  await page.waitForTimeout(200)
  const taskInput = page.locator('input[placeholder*="Task name"]').first()
  await taskInput.fill(taskName)
  const addSubmit = page.locator('button:has-text("Add task")').last()
  await addSubmit.click()
  await page.waitForTimeout(500)
}

async function createProject(name: string) {
  await ensureSidebarVisible()
  const addProjectBtn = page.locator('button[title="Add project"]').first()
  await addProjectBtn.click()
  await page.waitForTimeout(500)

  const nameInput = page.locator('input[placeholder="Project name"]').first()
  await nameInput.waitFor({ state: 'visible' })
  await nameInput.fill(name)

  const submitBtn = page.locator('.fixed.inset-0 button:has-text("Add")').first()
  await submitBtn.click()
  await page.waitForTimeout(500)
}

// ============================================================
// BUG #79: Project name not squashed by sort/group dropdowns
// ============================================================
test.describe('Bug #79: Project header layout', () => {
  const projectName = `LongProjectName-${Date.now()}`

  test('should display project name without being squashed by controls', async () => {
    await goToInbox()
    await createProject(projectName)

    // Navigate to the project
    await ensureSidebarVisible()
    const projectBtn = page.locator(`button:has-text("${projectName}")`).first()
    await projectBtn.click()
    await page.waitForTimeout(500)

    // Verify the project name heading is visible
    const heading = page.locator(`h1:has-text("${projectName}")`)
    await heading.waitFor({ state: 'visible' })
    expect(await heading.isVisible()).toBe(true)

    // Verify the sort/group controls are on a separate row from the title
    const sortBtn = page.locator('button:has-text("Sort:")').first()
    const groupBtn = page.locator('button:has-text("Group:")').first()
    expect(await sortBtn.isVisible()).toBe(true)
    expect(await groupBtn.isVisible()).toBe(true)

    // The heading and sort controls should not overlap - heading should have full width
    const headingBox = await heading.boundingBox()
    const sortBox = await sortBtn.boundingBox()
    expect(headingBox).not.toBeNull()
    expect(sortBox).not.toBeNull()

    if (headingBox && sortBox) {
      // Sort controls should be below the heading (on a separate row)
      expect(sortBox.y).toBeGreaterThan(headingBox.y)
    }
  })

  test('project name should have truncation class for long names', async () => {
    // The h1 should have 'truncate' class to handle very long names
    const heading = page.locator(`h1:has-text("${projectName}")`)
    const hasClass = await heading.evaluate((el) => el.classList.contains('truncate'))
    expect(hasClass).toBe(true)
  })
})

// ============================================================
// BUG #80: New label from task edit should show in sidebar
// ============================================================
test.describe('Bug #80: Label created from task edit appears in sidebar', () => {
  const labelName = `QuickLabel-${Date.now()}`

  test('should show new label in sidebar after creating from task edit dialog', async () => {
    await goToInbox()
    const taskName = `LabelTask-${Date.now()}`
    await createTask(taskName)

    // Open the task edit dialog
    const taskContent = page.locator(`.task-item .cursor-pointer:has-text("${taskName}")`).first()
    await taskContent.click()
    await page.waitForTimeout(600)

    // Verify edit dialog is open
    await page.locator('h2:has-text("Edit task")').waitFor({ state: 'visible' })

    // Find the label selector and open it
    const labelTrigger = page.locator('.fixed.inset-0 .relative:has(> div.flex.flex-wrap)').first()
    if (await labelTrigger.isVisible().catch(() => false)) {
      await labelTrigger.click()
      await page.waitForTimeout(300)
    }

    // Type a new label name in the label search/create input
    const labelInput = page.locator('input[placeholder="Search or create label..."]').first()
    if (await labelInput.isVisible().catch(() => false)) {
      await labelInput.fill(labelName)
      await page.waitForTimeout(200)

      // Press Enter to create the label
      await labelInput.press('Enter')
      await page.waitForTimeout(500)

      // Close label dropdown by clicking elsewhere in dialog
      await page.locator('h2:has-text("Edit task")').click()
      await page.waitForTimeout(200)
    }

    // Close dialog
    await closeDialogs()
    await page.waitForTimeout(300)

    // Check sidebar for the new label
    await ensureSidebarVisible()
    const sidebarLabel = page.locator(`button:has-text("${labelName}")`).first()
    const labelVisible = await sidebarLabel.isVisible().catch(() => false)
    expect(labelVisible).toBe(true)
  })
})

// ============================================================
// BUG #81: Subtasks should show in Today view
// ============================================================
test.describe('Bug #81: Subtasks in Today view', () => {
  test('should show subtasks of tasks due today', async () => {
    await goToInbox()
    const parentName = `TodayParent-${Date.now()}`
    const subtaskName = `TodaySubtask-${Date.now()}`
    await createTask(parentName)

    // Open the parent task edit dialog to set due date
    const taskContent = page.locator(`.task-item .cursor-pointer:has-text("${parentName}")`).first()
    await taskContent.click()
    await page.waitForTimeout(600)
    await page.locator('h2:has-text("Edit task")').waitFor({ state: 'visible' })

    const dialog = page.locator('.fixed.inset-0')

    // Set due date using the DatePicker - click "No due date" to open popover
    const dueDateBtn = dialog.locator('button:has-text("No due date")').first()
    await dueDateBtn.click()
    await page.waitForTimeout(300)

    // Click "Tomorrow" quick option (avoid "Today" which conflicts with sidebar)
    const tomorrowBtn = dialog.locator('.bg-popover button:has-text("Tomorrow")').first()
    await tomorrowBtn.waitFor({ state: 'visible' })
    await tomorrowBtn.click()
    await page.waitForTimeout(300)

    // Verify date was set (button text should change from "No due date")
    const dateSet = await dialog.locator('button:has-text("Tomorrow")').first().isVisible().catch(() => false)
    expect(dateSet).toBe(true)

    // Add a subtask via the "Add subtask" button - need to scroll down in dialog
    const addSubtaskBtn = dialog.locator('button:has-text("Add subtask")').first()
    await addSubtaskBtn.scrollIntoViewIfNeeded()
    await addSubtaskBtn.waitFor({ state: 'visible' })
    await addSubtaskBtn.click()
    await page.waitForTimeout(300)

    const subtaskInput = dialog.locator('input[placeholder="Subtask name"]').first()
    await subtaskInput.waitFor({ state: 'visible' })
    await subtaskInput.fill(subtaskName)

    // Click "Add" button for subtask
    const addBtn = dialog.locator('button:has-text("Add")').last()
    await addBtn.click()
    await page.waitForTimeout(500)

    // Dialog uses autosave - close it (Escape triggers autosave flush)
    await closeDialogs()
    await page.waitForTimeout(500)

    // Re-open the task to change due date from Tomorrow to Today
    const taskContent2 = page.locator(`.task-item .cursor-pointer:has-text("${parentName}")`).first()
    await taskContent2.click()
    await page.waitForTimeout(600)
    await page.locator('h2:has-text("Edit task")').waitFor({ state: 'visible' })

    const dialog2 = page.locator('.fixed.inset-0')
    // Click the current date display (it shows "Tomorrow")
    const currentDateBtn = dialog2.locator('button:has-text("Tomorrow")').first()
    await currentDateBtn.click()
    await page.waitForTimeout(300)

    // Click "Today" in the date picker popover (scoped to .bg-popover)
    const todayQuickBtn = dialog2.locator('.bg-popover .bg-muted:has-text("Today")').first()
    await todayQuickBtn.waitFor({ state: 'visible' })
    await todayQuickBtn.click()
    await page.waitForTimeout(300)

    // Close dialog (autosave will flush)
    await closeDialogs()
    await page.waitForTimeout(500)

    // Navigate to Today view
    await ensureSidebarVisible()
    await page.click('aside button:has-text("Today")')
    await page.waitForTimeout(500)
    await page.locator('h1:has-text("Today")').waitFor({ state: 'visible' })

    // Verify parent task is visible
    const parentVisible = await page.locator(`text="${parentName}"`).isVisible().catch(() => false)
    expect(parentVisible).toBe(true)

    // Expand subtasks if collapsed
    const expandToggle = page.locator(`.task-item:has-text("${parentName}") button:has(.lucide-chevron-right)`).first()
    if (await expandToggle.isVisible().catch(() => false)) {
      await expandToggle.click()
      await page.waitForTimeout(300)
    }

    // The subtask should be visible (getToday() now returns subtasks of today's tasks)
    const subtaskVisible = await page.locator(`text="${subtaskName}"`).isVisible().catch(() => false)
    expect(subtaskVisible).toBe(true)
  })
})

// ============================================================
// BUG #82: "Group by Project" should not appear in project view
// ============================================================
test.describe('Bug #82: No redundant Project group-by in project view', () => {
  const projName = `GroupByProj-${Date.now()}`

  test('should not show "Project" option in group-by dropdown within project view', async () => {
    // First ensure clean state
    await closeDialogs()
    await goToInbox()

    // Create a project
    await createProject(projName)

    // Navigate to the project via sidebar
    await closeDialogs()
    await ensureSidebarVisible()
    const projectBtn = page.locator(`aside button:has-text("${projName}")`).first()
    await projectBtn.waitFor({ state: 'visible' })
    await projectBtn.click()
    await page.waitForTimeout(500)

    // Verify we're in the project view
    await page.locator(`h1:has-text("${projName}")`).waitFor({ state: 'visible' })

    // Click the Group dropdown
    const groupBtn = page.locator('button:has-text("Group:")').first()
    await groupBtn.waitFor({ state: 'visible' })
    await groupBtn.click()
    await page.waitForTimeout(300)

    // Get all options in the dropdown
    const dropdownOptions = page.locator('.absolute.z-50 button')
    const texts = await dropdownOptions.allTextContents()

    // "Project" should NOT be in the dropdown options
    const hasProjectOption = texts.some((t) => t.trim() === 'Project')
    expect(hasProjectOption).toBe(false)

    // But other options should be present
    expect(texts.some((t) => t.trim() === 'None')).toBe(true)
    expect(texts.some((t) => t.trim() === 'Priority')).toBe(true)
    expect(texts.some((t) => t.trim() === 'Due date')).toBe(true)

    // Close dropdown
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  })

  test('should still show "Project" group-by option in Inbox view', async () => {
    await goToInbox()

    // Open group dropdown in Inbox
    const groupBtn = page.locator('button:has-text("Group:")').first()
    await groupBtn.waitFor({ state: 'visible' })
    await groupBtn.click()
    await page.waitForTimeout(300)

    // "Project" SHOULD appear in Inbox view
    const dropdownOptions = page.locator('.absolute.z-50 button')
    const texts = await dropdownOptions.allTextContents()
    const hasProjectOption = texts.some((t) => t.trim() === 'Project')
    expect(hasProjectOption).toBe(true)

    // Close dropdown
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  })
})

// ============================================================
// BUG: X button close should flush pending autosave
// ============================================================
test.describe('Bug: X button flushes pending autosave', () => {
  const taskName = `XCloseFlush-${Date.now()}`

  test('should save edits when closing dialog via X button', async () => {
    await goToInbox()
    await createTask(taskName)

    // Click task content to open edit dialog
    const taskContent = page.locator(`.task-item:has-text("${taskName}") .cursor-pointer`).first()
    await taskContent.click()
    await page.waitForTimeout(500)

    // Verify dialog opened
    const dialog = page.locator('.fixed.inset-0').first()
    await dialog.locator('text=Edit task').waitFor({ state: 'visible' })

    // Change priority to P1 (click the first flag button)
    const p1Flag = dialog.locator('button[title="Priority 1"]').first()
    await p1Flag.click()
    await page.waitForTimeout(100)

    // Immediately click the X button (before 800ms debounce fires)
    const xButton = dialog.locator('button:has(.lucide-x)').first()
    await xButton.click()
    await page.waitForTimeout(500)

    // Reopen the task dialog
    const taskContent2 = page.locator(`.task-item:has-text("${taskName}") .cursor-pointer`).first()
    await taskContent2.click()
    await page.waitForTimeout(500)

    // Verify priority was saved (P1 flag should be selected/filled)
    const dialog2 = page.locator('.fixed.inset-0').first()
    await dialog2.locator('text=Edit task').waitFor({ state: 'visible' })
    const p1Button = dialog2.locator('button[title="Priority 1"]').first()
    const p1Classes = await p1Button.getAttribute('class')
    expect(p1Classes).toContain('bg-accent')

    await closeDialogs()
  })
})

// Final check: no console errors during entire test run
test('should have no console errors throughout test run', () => {
  expect(consoleErrors).toHaveLength(0)
})
