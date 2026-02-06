import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchElectron } from './helpers'

let electronApp: ElectronApplication
let page: Page

// Collect console errors during tests
const consoleErrors: string[] = []

test.beforeAll(async () => {
  electronApp = await launchElectron()
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1000)

  // Listen for console errors throughout the test session
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
})

test.afterAll(async () => {
  await electronApp.close()
})

// Helper to ensure sidebar is visible
async function ensureSidebarVisible() {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)

  const sidebar = page.locator('aside').first()
  if (!(await sidebar.isVisible().catch(() => false))) {
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
  }
}

// Helper to go to Inbox
async function goToInbox() {
  await closeDialogs()
  await ensureSidebarVisible()
  // Click Today first to force navigation, then back to Inbox
  // This ensures a fresh fetch of the task list
  await page.click('button:has-text("Today")')
  await page.waitForTimeout(300)
  await page.click('button:has-text("Inbox")')
  await page.waitForTimeout(500)
  await page.locator('h1:has-text("Inbox")').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
}

// Helper to close any open dialogs
async function closeDialogs() {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

// Helper to create a task via the inline add input
async function createTask(taskName: string) {
  const addBtn = page.locator('button:has-text("Add task")').first()
  await addBtn.waitFor({ state: 'visible', timeout: 3000 })
  await addBtn.click()
  await page.waitForTimeout(200)
  const taskInput = page.locator('input[placeholder*="Task name"]').first()
  await taskInput.fill(taskName)
  // The submit button in the inline add form says "Add task"
  const addSubmit = page.locator('button:has-text("Add task")').last()
  await addSubmit.click()
  await page.waitForTimeout(500)
}

// Helper to open edit dialog for a task
async function openEditDialog(taskName: string) {
  const taskContent = page.locator(`.task-item .cursor-pointer:has-text("${taskName}")`).first()
  await taskContent.waitFor({ state: 'visible', timeout: 5000 })
  await taskContent.click()
  await page.waitForTimeout(600)

  // Verify edit dialog opened
  const editDialog = page.locator('h2:has-text("Edit task")')
  await editDialog.waitFor({ state: 'visible', timeout: 3000 })
}

// Helper to scroll dialog to bottom
async function scrollDialogToBottom() {
  const dialogBody = page.locator('.fixed.inset-0 .overflow-y-auto')
  if (await dialogBody.isVisible().catch(() => false)) {
    await dialogBody.evaluate(el => el.scrollTop = el.scrollHeight)
    await page.waitForTimeout(200)
  }
}

// Helper to save and close the edit dialog (autosave + close)
async function saveAndCloseDialog() {
  // Wait for autosave to complete
  await page.waitForTimeout(1200)
  const closeBtn = page.locator('.fixed.inset-0 button:has-text("Close")')
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(500)
  } else {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }
}

// Helper to clear console errors before a test
function clearConsoleErrors() {
  consoleErrors.length = 0
}

// ============================================================
// SUBTASK TESTS - Using Add subtask button in edit dialog
// ============================================================
test.describe('Subtasks - Add subtask via Edit Dialog UI', () => {
  const parentName = `SubParent-${Date.now()}`
  const subtaskName = `SubChild-${Date.now()}`

  test('should create subtask via Add subtask button in edit dialog', async () => {
    clearConsoleErrors()
    await goToInbox()

    // Create parent task
    await createTask(parentName)
    const parentTask = page.locator(`.task-item:has-text("${parentName}")`)
    await parentTask.waitFor({ state: 'visible', timeout: 3000 })

    // Open edit dialog for the parent task
    await openEditDialog(parentName)
    await scrollDialogToBottom()

    // Verify "Subtasks (0)" is visible
    const subtasksLabel = page.locator('text=Subtasks (0)')
    await subtasksLabel.waitFor({ state: 'visible', timeout: 3000 })
    expect(await subtasksLabel.isVisible()).toBe(true)

    // Click "Add subtask" button
    const addSubtaskBtn = page.locator('button:has-text("Add subtask")')
    await addSubtaskBtn.waitFor({ state: 'visible', timeout: 3000 })
    await addSubtaskBtn.click()
    await page.waitForTimeout(300)

    // Subtask input should appear
    const subtaskInput = page.locator('input[placeholder="Subtask name"]')
    await subtaskInput.waitFor({ state: 'visible', timeout: 3000 })

    // Type subtask name and press Enter
    await subtaskInput.fill(subtaskName)
    await page.waitForTimeout(100)
    await subtaskInput.press('Enter')
    await page.waitForTimeout(800)

    // Verify no console errors occurred during subtask creation
    const subtaskErrors = consoleErrors.filter(e => e.includes('subtask') || e.includes('Failed'))
    expect(subtaskErrors).toHaveLength(0)

    // Verify "Subtasks (1)" is now visible (count updated)
    const subtasksOne = page.locator('text=Subtasks (1)')
    await subtasksOne.waitFor({ state: 'visible', timeout: 3000 })
    expect(await subtasksOne.isVisible()).toBe(true)

    // Verify subtask name appears in the dialog
    const subtaskInDialog = page.locator(`.fixed.inset-0 span:has-text("${subtaskName}")`)
    expect(await subtaskInDialog.isVisible()).toBe(true)

    // Verify the edit dialog is still open (Enter didn't submit the outer form)
    const editDialogTitle = page.locator('h2:has-text("Edit task")')
    expect(await editDialogTitle.isVisible()).toBe(true)

    // Save the dialog to ensure parent view refreshes its task list
    await saveAndCloseDialog()
  })

  test('should show subtask in task list with indentation after saving dialog', async () => {
    // Navigate to Inbox to get fresh task list
    await goToInbox()

    // Verify parent task is visible
    const parentTask = page.locator(`.task-item:has-text("${parentName}")`)
    await parentTask.waitFor({ state: 'visible', timeout: 5000 })
    expect(await parentTask.isVisible()).toBe(true)

    // Verify subtask is visible in the task list
    const subtask = page.locator(`.task-item:has-text("${subtaskName}")`)
    await subtask.waitFor({ state: 'visible', timeout: 5000 })
    expect(await subtask.isVisible()).toBe(true)

    // Verify indentation - subtask should have paddingLeft > 0
    const paddingStyle = await subtask.evaluate(el => {
      let current: HTMLElement | null = el as HTMLElement
      while (current) {
        const inlineStyle = current.style.paddingLeft
        if (inlineStyle && parseInt(inlineStyle) > 0) return parseInt(inlineStyle)
        current = current.parentElement
      }
      return 0
    })
    expect(paddingStyle).toBeGreaterThanOrEqual(24)

    // Verify collapse/expand toggle appears on the parent task
    const collapseBtn = page.locator('button[title="Collapse subtasks"], button[title="Expand subtasks"]').first()
    expect(await collapseBtn.isVisible()).toBe(true)
  })

  test('should collapse and expand subtasks from task list', async () => {
    const subtask = page.locator(`.task-item:has-text("${subtaskName}")`)
    expect(await subtask.isVisible()).toBe(true)

    // Click collapse
    const collapseBtn = page.locator('button[title="Collapse subtasks"]').first()
    await collapseBtn.click()
    await page.waitForTimeout(300)
    expect(await subtask.isVisible()).toBe(false)

    // Click expand
    const expandBtn = page.locator('button[title="Expand subtasks"]').first()
    await expandBtn.click()
    await page.waitForTimeout(300)
    expect(await subtask.isVisible()).toBe(true)
  })

  test('should show existing subtasks when reopening edit dialog', async () => {
    await goToInbox()
    await openEditDialog(parentName)
    await scrollDialogToBottom()

    // Subtask count should still be 1
    const subtasksOne = page.locator('text=Subtasks (1)')
    await subtasksOne.waitFor({ state: 'visible', timeout: 3000 })
    expect(await subtasksOne.isVisible()).toBe(true)

    // Subtask name should be visible
    const subtaskInDialog = page.locator(`.fixed.inset-0 span:has-text("${subtaskName}")`)
    expect(await subtaskInDialog.isVisible()).toBe(true)

    await closeDialogs()
  })

  test('should navigate to subtask edit dialog when clicking subtask name', async () => {
    clearConsoleErrors()
    await goToInbox()

    // Open parent task edit dialog
    await openEditDialog(parentName)
    await scrollDialogToBottom()

    // Verify subtask is listed
    const subtaskSpan = page.locator(`.fixed.inset-0 span:has-text("${subtaskName}")`).first()
    await subtaskSpan.waitFor({ state: 'visible', timeout: 3000 })

    // Click the subtask name to navigate to its edit dialog
    await subtaskSpan.click()
    await page.waitForTimeout(800)

    // The dialog should now show the subtask's content in the task name input
    const editDialog = page.locator('h2:has-text("Edit task")')
    await editDialog.waitFor({ state: 'visible', timeout: 3000 })

    // The task name field should contain the subtask name
    const taskNameInput = page.locator('.fixed.inset-0 input[type="text"]').first()
    const inputValue = await taskNameInput.inputValue()
    expect(inputValue).toBe(subtaskName)

    // Verify no console errors
    const errors = consoleErrors.filter(e =>
      e.includes('Failed') || e.includes('Error') || e.includes('error')
    )
    expect(errors).toHaveLength(0)

    await closeDialogs()
  })
})

// ============================================================
// SUB-PROJECT TESTS
// ============================================================
test.describe('Sub-projects - Parent project selector always visible', () => {
  const parentProjectName = `ParProj-${Date.now()}`
  const childProjectName = `ChiProj-${Date.now()}`

  test('should always show parent project selector in project dialog', async () => {
    clearConsoleErrors()
    await closeDialogs()
    await ensureSidebarVisible()

    // Open Add project dialog
    const addProjectBtn = page.locator('button[title="Add project"]').first()
    await addProjectBtn.click()
    await page.waitForTimeout(300)

    // Parent project label should ALWAYS be visible (even with no projects)
    const parentLabel = page.locator('label:has-text("Parent project")')
    await parentLabel.waitFor({ state: 'visible', timeout: 3000 })
    expect(await parentLabel.isVisible()).toBe(true)

    await closeDialogs()
  })

  test('should create parent project then sub-project with parent selector', async () => {
    await closeDialogs()
    await ensureSidebarVisible()

    // Step 1: Create parent project
    const addProjectBtn = page.locator('button[title="Add project"]').first()
    await addProjectBtn.click()
    await page.waitForTimeout(300)

    const nameInput = page.locator('input[placeholder="Project name"]')
    await nameInput.fill(parentProjectName)

    // Click Add button
    const addBtn = page.locator('.fixed.inset-0 button:has-text("Add")')
    await addBtn.click()
    await page.waitForTimeout(500)
    await closeDialogs()

    // Verify parent project appears in sidebar
    const parentProject = page.locator(`button:has-text("${parentProjectName}")`)
    await parentProject.waitFor({ state: 'visible', timeout: 5000 })
    expect(await parentProject.isVisible()).toBe(true)

    // Step 2: Create sub-project
    await addProjectBtn.click()
    await page.waitForTimeout(500)

    const nameInput2 = page.locator('input[placeholder="Project name"]')
    await nameInput2.fill(childProjectName)

    // Parent project selector should be visible and have our parent as option
    const parentSelect = page.locator('select').last()
    const parentLabel = page.locator('label:has-text("Parent project")')
    expect(await parentLabel.isVisible()).toBe(true)

    // Select the parent project
    await parentSelect.selectOption({ label: parentProjectName })
    await page.waitForTimeout(200)

    // Verify selection took effect
    const selectedValue = await parentSelect.inputValue()
    expect(selectedValue).not.toBe('')

    // Click Add
    const addBtn2 = page.locator('.fixed.inset-0 button:has-text("Add")')
    await addBtn2.click()
    await page.waitForTimeout(500)
    await closeDialogs()

    // Verify no console errors
    const projErrors = consoleErrors.filter(e => e.includes('project') || e.includes('Failed'))
    expect(projErrors).toHaveLength(0)

    // Verify child project appears in sidebar
    const childProject = page.locator(`button:has-text("${childProjectName}")`)
    await childProject.waitFor({ state: 'visible', timeout: 5000 })
    expect(await childProject.isVisible()).toBe(true)
  })

  test('should show sub-project indented under parent in sidebar', async () => {
    await ensureSidebarVisible()

    const childItem = page.locator(`div.sidebar-item:has(button:has-text("${childProjectName}"))`)
    const isVisible = await childItem.isVisible().catch(() => false)
    expect(isVisible).toBe(true)

    if (isVisible) {
      const paddingLeft = await childItem.evaluate((el) => {
        return parseInt(window.getComputedStyle(el).paddingLeft, 10)
      })
      // Child should have more padding than default (indented)
      expect(paddingLeft).toBeGreaterThan(12)
    }
  })

  test('should navigate to sub-project and see its tasks area', async () => {
    await ensureSidebarVisible()

    const childProject = page.locator(`button:has-text("${childProjectName}")`)
    await childProject.click()
    await page.waitForTimeout(500)

    const heading = page.locator(`h1:has-text("${childProjectName}")`)
    await heading.waitFor({ state: 'visible', timeout: 5000 })
    expect(await heading.isVisible()).toBe(true)
  })
})

// ============================================================
// COMMENT TESTS - With error checking and UI verification
// ============================================================
test.describe('Comments - Add, persist, and error handling', () => {
  const commentTaskName = `CmtTask-${Date.now()}`
  const commentText = `Test comment ${Date.now()}`

  test('should add comment to task without errors', async () => {
    clearConsoleErrors()
    await goToInbox()

    // Create a task
    await createTask(commentTaskName)

    // Open edit dialog
    await openEditDialog(commentTaskName)
    await scrollDialogToBottom()

    // Verify "Comments (0)" and "No comments yet"
    const commentsZero = page.locator('text=Comments (0)')
    await commentsZero.waitFor({ state: 'visible', timeout: 3000 })
    expect(await commentsZero.isVisible()).toBe(true)

    const noComments = page.locator('text=No comments yet')
    expect(await noComments.isVisible()).toBe(true)

    // Type comment
    const commentInput = page.locator('input[placeholder="Add a comment..."]')
    await commentInput.waitFor({ state: 'visible', timeout: 3000 })
    await commentInput.click()
    await page.keyboard.type(commentText, { delay: 10 })
    await page.waitForTimeout(200)

    // Verify input has the text
    expect(await commentInput.inputValue()).toBe(commentText)

    // Submit comment by pressing Enter
    await commentInput.press('Enter')
    await page.waitForTimeout(1000)

    // Check for console errors - there should be NONE
    const commentErrors = consoleErrors.filter(e =>
      e.includes('comment') || e.includes('Failed') || e.includes('Error')
    )
    expect(commentErrors).toHaveLength(0)

    // Verify no error message is displayed in the comments section
    // Use specific selector: error display within comments section uses bg-destructive/10
    const commentErrorMsg = page.locator('.bg-destructive\\/10')
    expect(await commentErrorMsg.isVisible().catch(() => false)).toBe(false)

    // Verify comment text appears in the dialog
    const commentElement = page.locator(`text=${commentText}`).first()
    await commentElement.waitFor({ state: 'visible', timeout: 5000 })
    expect(await commentElement.isVisible()).toBe(true)

    // Verify comment count updated
    const commentsOne = page.locator('text=Comments (1)')
    expect(await commentsOne.isVisible()).toBe(true)

    // Verify "No comments yet" is gone
    expect(await noComments.isVisible()).toBe(false)

    // Verify the edit dialog is still open (Enter didn't close it)
    const editDialogTitle = page.locator('h2:has-text("Edit task")')
    expect(await editDialogTitle.isVisible()).toBe(true)

    // Verify the comment input is cleared for next comment
    expect(await commentInput.inputValue()).toBe('')

    await closeDialogs()
  })

  test('should persist comments when reopening task edit dialog', async () => {
    await goToInbox()

    // Open the same task again
    await openEditDialog(commentTaskName)
    await scrollDialogToBottom()

    // Verify the comment persists
    const commentElement = page.locator(`text=${commentText}`).first()
    await commentElement.waitFor({ state: 'visible', timeout: 5000 })
    expect(await commentElement.isVisible()).toBe(true)

    // Verify count is still 1
    const commentsOne = page.locator('text=Comments (1)')
    expect(await commentsOne.isVisible()).toBe(true)

    await closeDialogs()
  })

  test('should add second comment and update count', async () => {
    clearConsoleErrors()
    await goToInbox()

    await openEditDialog(commentTaskName)
    await scrollDialogToBottom()

    // Add a second comment
    const secondComment = `Second comment ${Date.now()}`
    const commentInput = page.locator('input[placeholder="Add a comment..."]')
    await commentInput.click()
    await page.keyboard.type(secondComment, { delay: 10 })
    await page.waitForTimeout(200)

    await commentInput.press('Enter')
    await page.waitForTimeout(1000)

    // Verify no errors
    const commentErrors = consoleErrors.filter(e =>
      e.includes('comment') || e.includes('Failed') || e.includes('Error')
    )
    expect(commentErrors).toHaveLength(0)

    // Verify second comment appears
    const secondCommentEl = page.locator(`text=${secondComment}`).first()
    await secondCommentEl.waitFor({ state: 'visible', timeout: 5000 })
    expect(await secondCommentEl.isVisible()).toBe(true)

    // Verify count shows 2
    const commentsTwo = page.locator('text=Comments (2)')
    expect(await commentsTwo.isVisible()).toBe(true)

    await closeDialogs()
  })

  test('should show "No comments yet" for task without comments', async () => {
    await goToInbox()

    const noCommentTask = `NoCmts-${Date.now()}`
    await createTask(noCommentTask)

    await openEditDialog(noCommentTask)
    await scrollDialogToBottom()

    const noCommentsText = page.locator('text=No comments yet')
    expect(await noCommentsText.isVisible()).toBe(true)

    const commentsZero = page.locator('text=Comments (0)')
    expect(await commentsZero.isVisible()).toBe(true)

    await closeDialogs()
  })
})

// Final check: no console errors during entire test run
test('should have no console errors throughout test run', () => {
  expect(consoleErrors).toHaveLength(0)
})
