/**
 * Delegated user / "waiting for" E2E tests
 * - Set delegated user in edit dialog
 * - Verify delegated user badge on task item
 * - Verify autocomplete shows previously used names
 * - Filter by delegated:* and delegated:name
 * - Clear delegation
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

async function goToInbox() {
  await closeDialogs()
  const sidebar = page.locator('aside').first()
  if (!(await sidebar.isVisible().catch(() => false))) {
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(100)
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
  }
  await page.click('button:has-text("Today")')
  await page.waitForTimeout(300)
  await page.click('button:has-text("Inbox")')
  await page.waitForTimeout(500)
}

async function createTask(name: string) {
  await goToInbox()
  const addButton = page.locator('button:has-text("Add task")')
  await addButton.click()
  await page.waitForTimeout(300)

  const input = page.locator('input[placeholder*="Task name"]').first()
  await input.fill(name)
  await input.press('Enter')
  await page.waitForTimeout(500)
}

async function openEditDialog(taskName: string) {
  // Click on the task content to open edit dialog
  const taskContent = page.locator('.task-item').filter({ hasText: taskName }).locator('.cursor-pointer').first()
  await taskContent.click()
  await page.waitForTimeout(500)
}

test('should create a task and set delegated user in edit dialog', async () => {
  await createTask('Delegated task test')

  // Open edit dialog
  await openEditDialog('Delegated task test')

  // Find the "Delegated to" input
  const delegatedInput = page.locator('input[placeholder="Person name"]')
  await expect(delegatedInput).toBeVisible()

  // Type a person name
  await delegatedInput.fill('Alice')
  await page.waitForTimeout(1000) // Wait for autosave

  // Close dialog
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
})

test('should display delegated user badge on task item', async () => {
  // The badge should show "Alice" on the task
  const taskItem = page.locator('.task-item').filter({ hasText: 'Delegated task test' })
  const badge = taskItem.locator('text=Alice')
  await expect(badge).toBeVisible()
})

test('should persist delegated user after reopening edit dialog', async () => {
  await openEditDialog('Delegated task test')

  const delegatedInput = page.locator('input[placeholder="Person name"]')
  await expect(delegatedInput).toHaveValue('Alice')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

test('should create second task with different delegated user', async () => {
  await createTask('Another delegated task')
  await openEditDialog('Another delegated task')

  const delegatedInput = page.locator('input[placeholder="Person name"]')
  await delegatedInput.fill('Bob')
  await page.waitForTimeout(1000)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // Verify badge
  const taskItem = page.locator('.task-item').filter({ hasText: 'Another delegated task' })
  await expect(taskItem.locator('text=Bob')).toBeVisible()
})

test('should show autocomplete suggestions for previously used names', async () => {
  await createTask('Third task for autocomplete')
  await openEditDialog('Third task for autocomplete')

  const delegatedInput = page.locator('input[placeholder="Person name"]')
  // Focus to show suggestions
  await delegatedInput.click()
  await delegatedInput.fill('A')
  await page.waitForTimeout(500)

  // Look for Alice suggestion
  const suggestion = page.locator('button:has-text("Alice")')
  const isVisible = await suggestion.isVisible().catch(() => false)
  expect(isVisible).toBe(true)

  // Click the suggestion
  await suggestion.click()
  await page.waitForTimeout(300)

  // Verify the input was filled
  await expect(delegatedInput).toHaveValue('Alice')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

test('should clear delegated user', async () => {
  await openEditDialog('Delegated task test')

  // Click the clear button (X next to the input)
  const clearButton = page.locator('input[placeholder="Person name"]').locator('..').locator('button[title="Clear delegation"]')
  await clearButton.click()
  await page.waitForTimeout(1000) // Wait for autosave

  // Verify input is empty
  const delegatedInput = page.locator('input[placeholder="Person name"]')
  await expect(delegatedInput).toHaveValue('')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // Verify badge is gone
  const taskItem = page.locator('.task-item').filter({ hasText: 'Delegated task test' })
  const aliceBadge = taskItem.locator('.rounded-full:has-text("Alice")')
  await expect(aliceBadge).toHaveCount(0)
})

test('should create a filter with delegated:* and see delegated tasks', async () => {
  // Navigate to sidebar, create a filter
  const sidebar = page.locator('aside').first()
  if (!(await sidebar.isVisible().catch(() => false))) {
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(100)
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
  }

  // Click add filter button
  const addFilterButton = sidebar.locator('button[title="Add filter"]')
  await expect(addFilterButton).toBeVisible()
  await addFilterButton.click()
  await page.waitForTimeout(500)

  // Fill filter form in dialog
  const nameInput = page.locator('.fixed.inset-0 input[placeholder="Filter name"]')
  await expect(nameInput).toBeVisible()
  await nameInput.fill('Delegated tasks')

  const queryInput = page.locator('.fixed.inset-0 input[placeholder*="e.g."]')
  await expect(queryInput).toBeVisible()
  await queryInput.fill('delegated:*')
  await page.waitForTimeout(300)

  // Click Add button
  const createBtn = page.locator('.fixed.inset-0 button[type="submit"]')
  await expect(createBtn).toBeEnabled()
  await createBtn.click()
  await page.waitForTimeout(500)

  // Click the filter in sidebar to navigate
  const filterItem = sidebar.locator('button:has-text("Delegated tasks")')
  await expect(filterItem).toBeVisible()
  await filterItem.click()
  await page.waitForTimeout(500)

  // Should show delegated tasks - "Another delegated task" (Bob) and "Third task for autocomplete" (Alice)
  // "Delegated task test" had its delegation cleared
  const taskItems = page.locator('.task-item')
  const count = await taskItems.count()
  expect(count).toBeGreaterThanOrEqual(2)
})

test('should filter by specific delegated person', async () => {
  // Create a filter for delegated:bob
  const sidebar = page.locator('aside').first()
  const addFilterButton = sidebar.locator('button[title="Add filter"]')
  await expect(addFilterButton).toBeVisible()
  await addFilterButton.click()
  await page.waitForTimeout(500)

  const nameInput = page.locator('.fixed.inset-0 input[placeholder="Filter name"]')
  await expect(nameInput).toBeVisible()
  await nameInput.fill('Bob tasks')

  const queryInput = page.locator('.fixed.inset-0 input[placeholder*="e.g."]')
  await expect(queryInput).toBeVisible()
  await queryInput.fill('delegated:bob')
  await page.waitForTimeout(300)

  // Click Add button
  const createBtn = page.locator('.fixed.inset-0 button[type="submit"]')
  await expect(createBtn).toBeEnabled()
  await createBtn.click()
  await page.waitForTimeout(500)

  // Click the filter to see results
  const filterItem = sidebar.locator('button:has-text("Bob tasks")')
  await expect(filterItem).toBeVisible()
  await filterItem.click()
  await page.waitForTimeout(500)

  // Should only show the task delegated to Bob
  const bobTask = page.locator('.task-item:has-text("Another delegated task")')
  await expect(bobTask).toBeVisible()
})

test('should show task without delegated badge when not delegated', async () => {
  await goToInbox()

  await createTask('Non-delegated task')

  // This task should not have any UserCircle badge
  const taskItem = page.locator('.task-item').filter({ hasText: 'Non-delegated task' })
  await expect(taskItem).toBeVisible()

  // No delegated badge (UserCircle icon with text)
  const delegatedBadge = taskItem.locator('.bg-blue-100, .dark\\:bg-blue-900\\/30')
  await expect(delegatedBadge).toHaveCount(0)
})

test('should have no console errors', async () => {
  const errors = consoleErrors.filter(
    (e) =>
      !e.includes('Electron Security Warning') &&
      !e.includes('DevTools') &&
      !e.includes('source map') &&
      !e.includes('net::ERR')
  )
  expect(errors).toEqual([])
})
