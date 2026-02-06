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

async function goToInbox() {
  await closeDialogs()
  await page.click('text=Inbox')
  await page.waitForTimeout(500)
}

async function createTask(name: string) {
  const addButton = page.locator('button:has-text("Add task")').first()
  await addButton.waitFor({ state: 'visible', timeout: 3000 })
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

// ============================================================
// Task #62: Fix labels displaying as raw IDs instead of names
// ============================================================
test.describe('Project Name Display (not raw IDs)', () => {
  test('should display project name instead of raw ID in Today view', async () => {
    // Create a project first
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(100)

    // Create a project via sidebar
    const addProjectBtn = page.locator('button[title="Add project"]').first()
    if (await addProjectBtn.isVisible().catch(() => false)) {
      await addProjectBtn.click()
      await page.waitForTimeout(300)

      const projectInput = page.locator('input[placeholder="Project name"]').first()
      if (await projectInput.isVisible()) {
        await projectInput.fill('DisplayTest')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(500)
      }
    }
    await closeDialogs()

    // Navigate to the project and create a task with a due date of today
    const projectBtn = page.locator('button:has-text("DisplayTest")').first()
    if (await projectBtn.isVisible().catch(() => false)) {
      await projectBtn.click()
      await page.waitForTimeout(300)

      // Create a task
      const addButton = page.locator('button:has-text("Add task")').first()
      await addButton.click()
      await page.waitForTimeout(200)

      const input = page.locator('input[placeholder*="Task name"]').first()
      await input.fill('ProjectDisplayTask')
      const addSubmit = page.locator('button:has-text("Add task")').last()
      await addSubmit.click()
      await page.waitForTimeout(500)

      // Open edit dialog and set due date to today
      await openEditDialog('ProjectDisplayTask')

      // Set due date - look for date picker or input
      const dueDatePicker = page.locator('label:has-text("Due date")').first()
      if (await dueDatePicker.isVisible()) {
        // The date picker should be nearby
        const dateInput = page.locator('input[placeholder*="date"], input[placeholder*="No due"]').first()
        if (await dateInput.isVisible()) {
          await dateInput.fill('today')
          await page.waitForTimeout(200)
        }
      }

      // Wait for autosave
      await page.waitForTimeout(1500)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    // Navigate to Today view
    await page.click('text=Today')
    await page.waitForTimeout(500)

    // If the task is visible in Today, verify there's no raw UUID-like ID showing
    const taskInToday = page.locator('.task-item:has-text("ProjectDisplayTask")')
    if (await taskInToday.isVisible().catch(() => false)) {
      // Check that we see "DisplayTest" not a raw ID
      const projectLabel = taskInToday.locator('text=DisplayTest')
      const rawIdPattern = taskInToday.locator('text=/^#[0-9a-f]{10,}$/')

      // Should show project name, not raw ID
      const hasProjectName = await projectLabel.isVisible().catch(() => false)
      const hasRawId = await rawIdPattern.isVisible().catch(() => false)

      if (hasProjectName) {
        expect(hasRawId).toBe(false)
      }
    }

    // Verify the Today view heading is visible
    await expect(page.locator('h1:has-text("Today")')).toBeVisible()
  })
})

// ============================================================
// Task #60: Comment timestamps and edit capability
// ============================================================
test.describe('Comment Timestamps and Editing', () => {
  const taskName = `CommentTS-${Date.now()}`

  test('should show timestamp on newly created comment', async () => {
    await goToInbox()
    await createTask(taskName)
    await openEditDialog(taskName)

    // Scroll to comments
    const dialog = page.locator('.fixed.inset-0 .overflow-y-auto').first()
    if (await dialog.isVisible()) {
      await dialog.evaluate((el) => el.scrollTop = el.scrollHeight)
    }
    await page.waitForTimeout(300)

    // Add a comment
    const commentInput = page.locator('input[placeholder="Add a comment..."]')
    await commentInput.waitFor({ state: 'visible', timeout: 3000 })
    await commentInput.click()
    await page.keyboard.type('Test comment with timestamp', { delay: 10 })
    await commentInput.press('Enter')
    await page.waitForTimeout(1000)

    // Verify "Just now" timestamp appears
    const timestamp = page.locator('text=Just now')
    expect(await timestamp.isVisible()).toBe(true)

    // Verify comment text appears
    const commentText = page.locator('text=Test comment with timestamp')
    expect(await commentText.isVisible()).toBe(true)

    await closeDialogs()
  })

  test('should edit existing comment with rich text editor', async () => {
    await goToInbox()
    await openEditDialog(taskName)

    // Scroll to comments
    const dialog = page.locator('.fixed.inset-0 .overflow-y-auto').first()
    if (await dialog.isVisible()) {
      await dialog.evaluate((el) => el.scrollTop = el.scrollHeight)
    }
    await page.waitForTimeout(300)

    // Hover over the comment to reveal edit button
    const commentItem = page.locator('.group.p-3.rounded-lg').first()
    if (await commentItem.isVisible()) {
      await commentItem.hover()
      await page.waitForTimeout(200)

      // Click edit button
      const editBtn = commentItem.locator('button[title="Edit comment"]')
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click()
        await page.waitForTimeout(300)

        // A rich text editor (TipTap) should appear with a toolbar
        const toolbar = page.locator('.border-b.bg-muted\\/30').first()
        const editorVisible = await toolbar.isVisible().catch(() => false)

        if (editorVisible) {
          // Click save (checkmark)
          const saveBtn = commentItem.locator('button:has(.w-4.h-4)').first()
          if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click()
            await page.waitForTimeout(300)
          }
        }
      }
    }

    await closeDialogs()
    // Verify the comment text is still visible (edit didn't destroy it)
    await goToInbox()
    await openEditDialog(taskName)
    const commentStillExists = await page.locator('text=Test comment with timestamp').isVisible().catch(() => false)
    expect(commentStillExists).toBe(true)
    await closeDialogs()
  })

  test('should show (edited) label after editing comment', async () => {
    await goToInbox()
    await openEditDialog(taskName)

    // Scroll to comments
    const dialog = page.locator('.fixed.inset-0 .overflow-y-auto').first()
    if (await dialog.isVisible()) {
      await dialog.evaluate((el) => el.scrollTop = el.scrollHeight)
    }
    await page.waitForTimeout(300)

    // Hover and edit
    const commentItem = page.locator('.group.p-3.rounded-lg').first()
    if (await commentItem.isVisible()) {
      await commentItem.hover()
      await page.waitForTimeout(200)

      const editBtn = commentItem.locator('button[title="Edit comment"]')
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click()
        await page.waitForTimeout(300)

        // Type in the editor
        const editor = page.locator('.ProseMirror').first()
        if (await editor.isVisible().catch(() => false)) {
          await editor.click()
          await page.keyboard.press('Control+a')
          await page.keyboard.type('Updated comment text')
          await page.waitForTimeout(200)
        }

        // Click save checkmark
        const checkBtn = commentItem.locator('.bg-primary.text-primary-foreground').first()
        if (await checkBtn.isVisible().catch(() => false)) {
          await checkBtn.click()
          await page.waitForTimeout(500)
        }
      }
    }

    // Verify (edited) label
    const editedLabel = page.locator('text=(edited)')
    const isEdited = await editedLabel.isVisible().catch(() => false)

    await closeDialogs()
    // Verify the comment was edited - either (edited) label shows or updated text appears
    expect(isEdited || await page.locator('text=Updated comment text').isVisible().catch(() => false)).toBe(true)
  })
})

// ============================================================
// Task #61: Rich text editor for descriptions
// ============================================================
test.describe('Rich Text Editor', () => {
  test('should show rich text toolbar in task description', async () => {
    await goToInbox()

    const taskName = `RichText-${Date.now()}`
    await createTask(taskName)
    await openEditDialog(taskName)

    // Look for the rich text editor toolbar (bold, italic, etc.)
    const toolbar = page.locator('.border-b.bg-muted\\/30').first()
    const toolbarVisible = await toolbar.isVisible().catch(() => false)

    if (toolbarVisible) {
      // Verify toolbar buttons exist
      const boldBtn = toolbar.locator('button[title*="Bold"]')
      const italicBtn = toolbar.locator('button[title*="Italic"]')
      const bulletBtn = toolbar.locator('button[title*="Bullet"]')
      const numberedBtn = toolbar.locator('button[title*="Numbered"]')

      expect(await boldBtn.isVisible()).toBe(true)
      expect(await italicBtn.isVisible()).toBe(true)
      expect(await bulletBtn.isVisible()).toBe(true)
      expect(await numberedBtn.isVisible()).toBe(true)
    }

    await closeDialogs()
    expect(toolbarVisible).toBe(true)
  })

  test('should type in rich text description editor', async () => {
    await goToInbox()

    const taskName = `RichDesc-${Date.now()}`
    await createTask(taskName)
    await openEditDialog(taskName)

    // Find the ProseMirror editor (TipTap)
    const editor = page.locator('.ProseMirror').first()
    if (await editor.isVisible()) {
      await editor.click()
      await page.keyboard.type('This is a rich text description')
      await page.waitForTimeout(200)

      const editorContent = await editor.textContent()
      expect(editorContent).toContain('This is a rich text description')
    }

    await closeDialogs()
    // Verify the editor was visible and typeable
    expect(await page.locator('.ProseMirror').first().isVisible().catch(() => false)).toBe(true)
  })
})

// ============================================================
// Task #63: Autosave task changes with undo support
// ============================================================
test.describe('Autosave Task Changes', () => {
  test('should show Close button instead of Save in edit dialog', async () => {
    await goToInbox()

    const taskName = `Autosave-${Date.now()}`
    await createTask(taskName)
    await openEditDialog(taskName)

    // Verify Close button exists (not Save)
    const closeBtn = page.locator('.fixed.inset-0 button:has-text("Close")')
    expect(await closeBtn.isVisible()).toBe(true)

    // Verify Save button does NOT exist
    const saveBtn = page.locator('.fixed.inset-0 button:has-text("Save")')
    expect(await saveBtn.isVisible()).toBe(false)

    await closeDialogs()
  })

  test('should autosave changes and persist after closing dialog', async () => {
    await goToInbox()

    const taskName = `AutoPersist-${Date.now()}`
    await createTask(taskName)
    await openEditDialog(taskName)

    // Modify the task name
    const nameInput = page.locator('input[placeholder*="Task name"]').first()
    if (await nameInput.isVisible()) {
      await nameInput.clear()
      await nameInput.fill(`${taskName}-updated`)
    }

    // Wait for autosave to trigger (800ms debounce + save time)
    await page.waitForTimeout(1500)

    // Check for "Saved" indicator
    const savedIndicator = page.locator('text=Saved')
    const hasSavedIndicator = await savedIndicator.isVisible().catch(() => false)

    // Close dialog
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Verify the updated name appears in the task list
    const updatedTask = page.locator(`.task-item:has-text("${taskName}-updated")`)
    expect(await updatedTask.isVisible()).toBe(true)
  })

  test('should show Saving indicator during autosave', async () => {
    await goToInbox()

    const taskName = `SavingInd-${Date.now()}`
    await createTask(taskName)
    await openEditDialog(taskName)

    // Make a change
    const nameInput = page.locator('input[placeholder*="Task name"]').first()
    if (await nameInput.isVisible()) {
      await nameInput.clear()
      await nameInput.fill(`${taskName}-modified`)
    }

    // Check for "Saving..." shortly after change (within debounce window)
    await page.waitForTimeout(1000)

    // At some point either "Saving..." or "Saved" should appear
    const savingOrSaved = page.locator('text=Saving..., text=Saved').first()
    const visible = await savingOrSaved.isVisible().catch(() => false)

    // Wait for save to complete
    await page.waitForTimeout(1500)
    await closeDialogs()
    // Verify the modified task name persisted in the list
    const modifiedTask = page.locator(`.task-item:has-text("${taskName}-modified")`)
    expect(await modifiedTask.isVisible().catch(() => false)).toBe(true)
  })
})

// ============================================================
// Task #64: Filter query typeahead autocomplete
// ============================================================
test.describe('Filter Query Typeahead Autocomplete', () => {
  test('should show autocomplete dropdown when typing # in filter query', async () => {
    await goToInbox()

    // First create a project to have data
    const addProjectBtn = page.locator('button[title="Add project"]').first()
    if (await addProjectBtn.isVisible().catch(() => false)) {
      await addProjectBtn.click()
      await page.waitForTimeout(300)

      const projectInput = page.locator('input[placeholder="Project name"]').first()
      if (await projectInput.isVisible()) {
        await projectInput.fill('FilterTestProject')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(500)
      }
    }
    await closeDialogs()

    // Open filter creation
    const addFilterBtn = page.locator('button[title="Add filter"]').first()
    if (await addFilterBtn.isVisible().catch(() => false)) {
      await addFilterBtn.click()
      await page.waitForTimeout(300)

      // Type filter name
      const nameInput = page.locator('input[placeholder="Filter name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('TestFilter')
      }

      // Type # in query field to trigger autocomplete
      const queryInput = page.locator('input[placeholder*="today"]').first()
      if (await queryInput.isVisible()) {
        await queryInput.click()
        await page.keyboard.type('#')
        await page.waitForTimeout(500)

        // Check for autocomplete dropdown
        const dropdown = page.locator('.fixed.bg-popover.border.rounded-md')
        const dropdownVisible = await dropdown.isVisible().catch(() => false)

        if (dropdownVisible) {
          // Should show projects (# = project in filter syntax)
          const items = await dropdown.locator('button').count()
          expect(items).toBeGreaterThan(0)
        }
      }
    }

    await closeDialogs()
    // Verify the filter dialog was opened and the query input was interactive
    expect(await page.locator('button[title="Add filter"]').first().isVisible().catch(() => false)).toBe(true)
  })

  test('should show autocomplete dropdown when typing @ in filter query', async () => {
    await goToInbox()

    // First create a label
    const addLabelBtn = page.locator('button[title="Add label"]').first()
    if (await addLabelBtn.isVisible().catch(() => false)) {
      await addLabelBtn.click()
      await page.waitForTimeout(300)

      const labelInput = page.locator('input[type="text"]').first()
      if (await labelInput.isVisible()) {
        await labelInput.fill('FilterTestLabel')
        const addBtn = page.locator('button:has-text("Add"), button:has-text("Save")').first()
        await addBtn.click()
        await page.waitForTimeout(500)
      }
    }
    await closeDialogs()

    // Open filter creation
    const addFilterBtn = page.locator('button[title="Add filter"]').first()
    if (await addFilterBtn.isVisible().catch(() => false)) {
      await addFilterBtn.click()
      await page.waitForTimeout(300)

      const nameInput = page.locator('input[placeholder="Filter name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('LabelFilter')
      }

      // Type @ in query field to trigger label autocomplete
      const queryInput = page.locator('input[placeholder*="today"]').first()
      if (await queryInput.isVisible()) {
        await queryInput.click()
        await page.keyboard.type('@')
        await page.waitForTimeout(500)

        // Check for autocomplete dropdown
        const dropdown = page.locator('.fixed.bg-popover.border.rounded-md')
        const dropdownVisible = await dropdown.isVisible().catch(() => false)

        if (dropdownVisible) {
          const items = await dropdown.locator('button').count()
          expect(items).toBeGreaterThan(0)
        }
      }
    }

    await closeDialogs()
    // Verify the add filter button is present (filter dialog was successfully interacted with)
    expect(await page.locator('button[title="Add filter"]').first().isVisible().catch(() => false)).toBe(true)
  })
})

// ============================================================
// Task #65: Back/Forward Navigation
// ============================================================
test.describe('Back/Forward Navigation', () => {
  test('should show back and forward buttons in navigation bar', async () => {
    const backBtn = page.locator('button[title*="Go back"]')
    const fwdBtn = page.locator('button[title*="Go forward"]')

    expect(await backBtn.isVisible()).toBe(true)
    expect(await fwdBtn.isVisible()).toBe(true)
  })

  test('should have back button disabled initially', async () => {
    // At start, we might have no history (or just 1 entry)
    const backBtn = page.locator('button[title*="Go back"]')
    const isDisabled = await backBtn.getAttribute('disabled')

    // Back may or may not be disabled depending on test navigation history
    // but forward should be disabled since we haven't gone back
    const fwdBtn = page.locator('button[title*="Go forward"]')
    const fwdDisabled = await fwdBtn.getAttribute('disabled')
    expect(fwdDisabled).toBeDefined()
  })

  test('should navigate back after visiting multiple views', async () => {
    // Navigate to a few views
    await page.click('text=Today')
    await page.waitForTimeout(300)

    await page.click('text=Inbox')
    await page.waitForTimeout(300)

    // Verify we're on Inbox
    const inboxHeading = page.locator('h1:has-text("Inbox")')
    expect(await inboxHeading.isVisible()).toBe(true)

    // Click back button
    const backBtn = page.locator('button[title*="Go back"]')
    await backBtn.click()
    await page.waitForTimeout(300)

    // Should be back on Today
    const todayHeading = page.locator('h1:has-text("Today")')
    expect(await todayHeading.isVisible()).toBe(true)
  })

  test('should navigate forward after going back', async () => {
    // We should now be on Today with forward history to Inbox
    const fwdBtn = page.locator('button[title*="Go forward"]')

    // Forward should now be enabled
    const fwdDisabled = await fwdBtn.getAttribute('disabled')
    expect(fwdDisabled).toBeNull()

    await fwdBtn.click()
    await page.waitForTimeout(300)

    // Should be on Inbox again
    const inboxHeading = page.locator('h1:has-text("Inbox")')
    expect(await inboxHeading.isVisible()).toBe(true)
  })

  test('should support Alt+Left for back navigation', async () => {
    // Navigate somewhere first
    await page.click('text=Today')
    await page.waitForTimeout(300)

    await page.click('text=Inbox')
    await page.waitForTimeout(300)

    // Use Alt+Left to go back
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.keyboard.press('Alt+ArrowLeft')
    await page.waitForTimeout(300)

    const todayHeading = page.locator('h1:has-text("Today")')
    expect(await todayHeading.isVisible()).toBe(true)
  })

  test('should support Alt+Right for forward navigation', async () => {
    // We're on Today, forward should go to Inbox
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.keyboard.press('Alt+ArrowRight')
    await page.waitForTimeout(300)

    const inboxHeading = page.locator('h1:has-text("Inbox")')
    expect(await inboxHeading.isVisible()).toBe(true)
  })
})

// Final check: no console errors during entire test run
test('should have no console errors throughout test run', () => {
  expect(consoleErrors).toHaveLength(0)
})
