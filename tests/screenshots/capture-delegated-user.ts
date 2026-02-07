/**
 * Capture screenshots for the Delegated User PR (#5)
 * Run: npx tsx tests/screenshots/capture-delegated-user.ts
 */
import { _electron as electron } from 'playwright'
import path from 'path'
import fs from 'fs'

const outDir = path.join(__dirname, 'output')
fs.mkdirSync(outDir, { recursive: true })

async function main() {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test', TODOER_TEST_MODE: 'true' }
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1500)

  // Helper to take a clean screenshot
  const screenshot = async (name: string) => {
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(outDir, `delegated-${name}.png`) })
    console.log(`  Captured: delegated-${name}.png`)
  }

  // --- Create first task ---
  console.log('Creating tasks...')
  const addBtn = page.locator('button:has-text("Add task")')
  await addBtn.click()
  await page.waitForTimeout(300)
  const input = page.locator('input[placeholder*="Task name"]').first()
  await input.fill('Review Q1 report')
  await input.press('Enter')
  await page.waitForTimeout(500)

  // Create second task
  await addBtn.click()
  await page.waitForTimeout(300)
  const input2 = page.locator('input[placeholder*="Task name"]').first()
  await input2.fill('Update project timeline')
  await input2.press('Enter')
  await page.waitForTimeout(500)

  // Create third task
  await addBtn.click()
  await page.waitForTimeout(300)
  const input3 = page.locator('input[placeholder*="Task name"]').first()
  await input3.fill('Send meeting notes')
  await input3.press('Enter')
  await page.waitForTimeout(500)

  // --- Set delegation on first task ---
  console.log('Setting delegated users...')
  const task1 = page.locator('.task-item').filter({ hasText: 'Review Q1 report' }).locator('.cursor-pointer').first()
  await task1.click()
  await page.waitForTimeout(500)

  const delegatedInput = page.locator('input[placeholder="Person name"]')
  await delegatedInput.fill('Alice')
  await page.waitForTimeout(1000)
  await screenshot('01-edit-dialog-delegated-to')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // --- Set delegation on second task ---
  const task2 = page.locator('.task-item').filter({ hasText: 'Update project timeline' }).locator('.cursor-pointer').first()
  await task2.click()
  await page.waitForTimeout(500)

  const delegatedInput2 = page.locator('input[placeholder="Person name"]')
  await delegatedInput2.fill('Bob')
  await page.waitForTimeout(1000)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // --- Screenshot: task list with badges ---
  await screenshot('02-task-list-with-badges')

  // --- Open task and show autocomplete ---
  const task3 = page.locator('.task-item').filter({ hasText: 'Send meeting notes' }).locator('.cursor-pointer').first()
  await task3.click()
  await page.waitForTimeout(500)

  const delegatedInput3 = page.locator('input[placeholder="Person name"]')
  await delegatedInput3.click()
  await delegatedInput3.fill('A')
  await page.waitForTimeout(500)
  await screenshot('03-autocomplete-suggestions')

  // Select Alice from autocomplete
  const suggestion = page.locator('button:has-text("Alice")')
  if (await suggestion.isVisible().catch(() => false)) {
    await suggestion.click()
    await page.waitForTimeout(300)
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // --- Screenshot: all tasks with delegation badges ---
  await screenshot('04-all-tasks-delegated')

  // --- Create filter for delegated tasks ---
  console.log('Creating delegated filter...')
  const sidebar = page.locator('aside').first()
  const addFilterBtn = sidebar.locator('button[title="Add filter"]')
  await addFilterBtn.click()
  await page.waitForTimeout(500)

  const nameInput = page.locator('.fixed.inset-0 input[placeholder="Filter name"]')
  await nameInput.fill('Delegated tasks')

  const queryInput = page.locator('.fixed.inset-0 input[placeholder*="e.g."]')
  await queryInput.fill('delegated:*')
  await page.waitForTimeout(300)
  await screenshot('05-filter-creation')

  const createBtn = page.locator('.fixed.inset-0 button[type="submit"]')
  await createBtn.click()
  await page.waitForTimeout(500)

  // Click the filter in sidebar
  const filterItem = sidebar.locator('button:has-text("Delegated tasks")')
  if (await filterItem.isVisible().catch(() => false)) {
    await filterItem.click()
    await page.waitForTimeout(500)
    await screenshot('06-filter-results')
  }

  console.log('Done! Screenshots saved to tests/screenshots/output/')
  await app.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
