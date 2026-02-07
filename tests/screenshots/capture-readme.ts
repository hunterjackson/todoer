/**
 * Capture screenshots for the professional README.
 * Run: npm run build && npx tsx tests/screenshots/capture-readme.ts
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
  await page.waitForTimeout(2000)

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(500)

  const screenshot = async (name: string) => {
    await page.waitForTimeout(400)
    const filepath = path.join(outDir, `readme-${name}.png`)
    await page.screenshot({ path: filepath })
    console.log(`  ✓ ${name}`)
  }

  const closeDialogs = async () => {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
    }
    await page.waitForTimeout(300)
  }

  const ensureSidebar = async () => {
    const sidebar = page.locator('aside').first()
    if (!(await sidebar.isVisible().catch(() => false))) {
      await page.keyboard.press('m')
      await page.waitForTimeout(500)
    }
  }

  const blur = async () => {
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.waitForTimeout(200)
  }

  const goToView = async (name: string) => {
    await closeDialogs()
    await ensureSidebar()
    await page.locator(`aside button:has-text("${name}")`).first().click()
    await page.waitForTimeout(600)
  }

  console.log('\n📸 Capturing README screenshots...\n')

  // =============================================
  // PHASE 1: Create sample data via IPC API (reliable, no UI flakiness)
  // =============================================
  console.log('Phase 1: Setting up sample data via API...')

  // Create labels
  const labels: Record<string, string> = {}
  for (const name of ['urgent', 'meeting', 'research', 'bug', 'design']) {
    const label = await page.evaluate(
      (n) => window.api.labels.create({ name: n, color: '' }),
      name
    )
    labels[name] = label.id
    console.log(`  Label: ${name} → ${label.id}`)
  }

  // Create projects
  const projects: Record<string, string> = {}
  for (const name of ['Work', 'Personal', 'Side Project']) {
    const project = await page.evaluate(
      (n) => window.api.projects.create({ name: n }),
      name
    )
    projects[name] = project.id
    console.log(`  Project: ${name} → ${project.id}`)
  }

  // Create sections in Work project
  const sectionNames = ['To Do', 'In Progress', 'Done']
  const sections: Record<string, string> = {}
  for (const name of sectionNames) {
    const section = await page.evaluate(
      ({ name, projectId }) => window.api.sections.create({ name, projectId }),
      { name, projectId: projects['Work'] }
    )
    sections[name] = section.id
    console.log(`  Section: ${name} → ${section.id}`)
  }

  // Helper: timestamps
  const now = Date.now()
  const DAY = 86400000
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const today = todayMidnight.getTime()
  const yesterday = today - DAY
  const tomorrow = today + DAY

  // Create tasks with full attributes — a mix of inbox + project tasks
  const tasks: Array<{
    content: string
    description?: string
    projectId?: string | null
    sectionId?: string | null
    dueDate?: number | null
    priority?: number
    labelIds?: string[]
    duration?: number | null
    parentId?: string | null
  }> = [
    // Inbox tasks (no project)
    {
      content: 'Review quarterly report',
      dueDate: today,
      priority: 1,
      labelIds: [labels['urgent']],
      description: 'Q4 numbers need final review before the board meeting'
    },
    {
      content: 'Schedule dentist appointment',
      dueDate: tomorrow,
      priority: 4
    },
    {
      content: 'Read "Designing Data-Intensive Applications" Ch. 5',
      dueDate: today + 3 * DAY,
      priority: 3,
      labelIds: [labels['research']]
    },
    {
      content: 'Buy groceries for the week',
      dueDate: today,
      priority: 3
    },
    // Work project tasks
    {
      content: 'Fix login page bug',
      projectId: projects['Work'],
      sectionId: sections['In Progress'],
      dueDate: today,
      priority: 1,
      labelIds: [labels['bug']],
      description: 'Login page throws 500 when credentials contain special characters like & or #. Affects ~12% of users.',
      duration: 45
    },
    {
      content: 'Prepare sprint demo slides',
      projectId: projects['Work'],
      sectionId: sections['In Progress'],
      dueDate: tomorrow,
      priority: 2,
      labelIds: [labels['meeting']]
    },
    {
      content: 'Write API documentation',
      projectId: projects['Work'],
      sectionId: sections['To Do'],
      dueDate: today + 3 * DAY,
      priority: 2
    },
    {
      content: 'Deploy v2.1 to staging',
      projectId: projects['Work'],
      sectionId: sections['To Do'],
      dueDate: today + 2 * DAY,
      priority: 2,
      labelIds: [labels['urgent']]
    },
    {
      content: 'Code review: auth refactor PR',
      projectId: projects['Work'],
      sectionId: sections['To Do'],
      dueDate: tomorrow,
      priority: 3
    },
    {
      content: 'Update CI pipeline config',
      projectId: projects['Work'],
      sectionId: sections['Done'],
      dueDate: yesterday,
      priority: 3
    },
    // Personal project tasks
    {
      content: 'Plan weekend hiking trip',
      projectId: projects['Personal'],
      dueDate: today + 4 * DAY,
      priority: 3
    },
    {
      content: 'Research new laptop options',
      projectId: projects['Personal'],
      dueDate: today + 5 * DAY,
      priority: 4,
      labelIds: [labels['research']]
    },
    // Side Project tasks
    {
      content: 'Design landing page mockup',
      projectId: projects['Side Project'],
      dueDate: today + 2 * DAY,
      priority: 2,
      labelIds: [labels['design']]
    },
    {
      content: 'Set up project repository',
      projectId: projects['Side Project'],
      dueDate: today + 6 * DAY,
      priority: 3
    }
  ]

  const createdTasks: Record<string, string> = {}
  for (const task of tasks) {
    const created = await page.evaluate((t) => window.api.tasks.create(t), task)
    createdTasks[task.content] = created.id
    console.log(`  Task: ${task.content}`)
  }

  // Add subtasks to "Fix login page bug"
  const bugTaskId = createdTasks['Fix login page bug']
  const subtasks = [
    'Reproduce the bug locally',
    'Write regression test',
    'Deploy fix to staging'
  ]
  for (const st of subtasks) {
    await page.evaluate(
      ({ content, parentId, projectId }) =>
        window.api.tasks.create({ content, parentId, projectId }),
      { content: st, parentId: bugTaskId, projectId: projects['Work'] }
    )
    console.log(`    Subtask: ${st}`)
  }

  // Add a comment to the bug task
  await page.evaluate(
    ({ taskId, content }) =>
      window.api.comments.create({ taskId, content }),
    {
      taskId: bugTaskId,
      content: 'Found the root cause — the input sanitizer strips valid characters. Need to update the regex pattern.'
    }
  )
  console.log('  Comment added to bug task')

  // Add a second comment
  await page.evaluate(
    ({ taskId, content }) =>
      window.api.comments.create({ taskId, content }),
    {
      taskId: bugTaskId,
      content: 'Fix is ready for review. Updated sanitizer to allow & and # in password fields.'
    }
  )

  // Complete one task in Done section
  const ciTaskId = createdTasks['Update CI pipeline config']
  await page.evaluate((id) => window.api.tasks.complete(id), ciTaskId)
  console.log('  Completed: Update CI pipeline config')

  // Create filters
  await page.evaluate((data) => window.api.filters.create(data), {
    name: 'High Priority',
    query: 'p1 | p2'
  })
  await page.evaluate((data) => window.api.filters.create(data), {
    name: 'Overdue',
    query: 'overdue'
  })
  console.log('  Filters: High Priority, Overdue')

  // Reload the page to pick up all the new data
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2000)

  // =============================================
  // PHASE 2: Capture screenshots
  // =============================================
  console.log('\nPhase 2: Capturing screenshots...\n')

  // --- 1: Hero — Inbox view ---
  await goToView('Inbox')
  await blur()
  await screenshot('hero-inbox')

  // --- 2: Today View ---
  await goToView('Today')
  await blur()
  await screenshot('today-view')

  // --- 3: Upcoming View ---
  await blur()
  await page.keyboard.press('g')
  await page.waitForTimeout(200)
  await page.keyboard.press('u')
  await page.waitForTimeout(800)
  await screenshot('upcoming-view')

  // --- 4: Calendar View ---
  await blur()
  await page.keyboard.press('g')
  await page.waitForTimeout(200)
  await page.keyboard.press('c')
  await page.waitForTimeout(800)
  // Click on today's date to show the side panel
  const todayDate = new Date().getDate().toString()
  const todayCell = page.locator(`.font-bold.text-primary:has-text("${todayDate}")`).first()
  if (await todayCell.isVisible().catch(() => false)) {
    await todayCell.click()
    await page.waitForTimeout(500)
  }
  await screenshot('calendar-view')

  // --- 5: Quick Add Modal ---
  await blur()
  await page.keyboard.press('q')
  await page.waitForTimeout(600)
  const quickAddInput = page.locator('.fixed.inset-0 input[placeholder*="Task name"]').first()
  if (await quickAddInput.isVisible().catch(() => false)) {
    await quickAddInput.fill('Review API design doc tomorrow #Work @urgent p1')
    await page.waitForTimeout(500)
  }
  await screenshot('quick-add')
  await closeDialogs()

  // --- 6: Edit Dialog (fully populated task) ---
  // Navigate to Work project to find the bug task
  await ensureSidebar()
  await page.locator('aside button:has-text("Work")').first().click()
  await page.waitForTimeout(800)

  // Click the task to open edit dialog
  const bugTask = page.locator('.task-item').filter({ hasText: 'Fix login page bug' }).locator('.cursor-pointer').first()
  if (await bugTask.isVisible().catch(() => false)) {
    await bugTask.click()
    await page.waitForTimeout(800)
  }

  // Scroll dialog to top
  const dialogContent = page.locator('.fixed.inset-0 .overflow-y-auto').first()
  if (await dialogContent.isVisible().catch(() => false)) {
    await dialogContent.evaluate((el) => (el.scrollTop = 0))
    await page.waitForTimeout(300)
  }
  await screenshot('edit-dialog')

  // Scroll to bottom to show comments
  if (await dialogContent.isVisible().catch(() => false)) {
    await dialogContent.evaluate((el) => (el.scrollTop = el.scrollHeight))
    await page.waitForTimeout(300)
  }
  await screenshot('comments')
  await closeDialogs()

  // --- 7: Project Board View ---
  // Should still be on Work project
  await ensureSidebar()
  await page.locator('aside button:has-text("Work")').first().click()
  await page.waitForTimeout(800)

  const boardBtn = page.locator('button[title="Board view"]')
  if (await boardBtn.isVisible().catch(() => false)) {
    await boardBtn.click()
    await page.waitForTimeout(800)
  }
  await screenshot('project-board')

  // Switch to list view
  const listBtn = page.locator('button[title="List view"]')
  if (await listBtn.isVisible().catch(() => false)) {
    await listBtn.click()
    await page.waitForTimeout(600)
  }
  await screenshot('project-list')

  // --- 8: Sidebar (with populated data) ---
  await goToView('Inbox')
  await screenshot('sidebar')

  // --- 9: Filter View ---
  await ensureSidebar()
  const filterBtn = page.locator('aside').first().locator('button:has-text("High Priority")').first()
  if (await filterBtn.isVisible().catch(() => false)) {
    await filterBtn.click()
    await page.waitForTimeout(800)
  }
  await screenshot('filter-view')

  // --- 10: Search ---
  await blur()
  await page.keyboard.press('/')
  await page.waitForTimeout(600)
  const searchInput = page.locator('input[placeholder*="Search"]').first()
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('bug')
    await page.waitForTimeout(800)
  }
  await screenshot('search')

  // Navigate away from search to clear it
  await goToView('Inbox')

  // --- 11: Keyboard Shortcuts ---
  await blur()
  await page.keyboard.press('?')
  await page.waitForTimeout(600)
  await screenshot('keyboard-shortcuts')
  await closeDialogs()

  // --- 12: Settings ---
  await blur()
  await page.keyboard.press('Control+,')
  await page.waitForTimeout(600)
  await screenshot('settings')
  await closeDialogs()

  // --- 13: Dark Mode ---
  await ensureSidebar()
  const darkBtn = page.locator('aside button[title="Dark"]').first()
  if (await darkBtn.isVisible().catch(() => false)) {
    await darkBtn.click()
    await page.waitForTimeout(800)
  }
  await goToView('Today')
  await blur()
  await screenshot('dark-mode')

  // Switch back to light
  await ensureSidebar()
  const lightBtn = page.locator('aside button[title="Light"]').first()
  if (await lightBtn.isVisible().catch(() => false)) {
    await lightBtn.click()
    await page.waitForTimeout(500)
  }

  console.log('\n✅ All screenshots captured!\n')
  console.log(`Output directory: ${outDir}`)
  await app.close()
}

main().catch((e) => {
  console.error('Screenshot capture failed:', e)
  process.exit(1)
})
