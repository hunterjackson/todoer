import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getDatabase, saveDatabase } from '../db'
import { TaskRepository } from '../db/repositories/taskRepository'
import { ProjectRepository } from '../db/repositories/projectRepository'
import { LabelRepository } from '../db/repositories/labelRepository'
import { SectionRepository } from '../db/repositories/sectionRepository'
import { FilterRepository } from '../db/repositories/filterRepository'
import { CommentRepository } from '../db/repositories/commentRepository'
import { ReminderRepository } from '../db/repositories/reminderRepository'
import { KarmaRepository } from '../db/repositories/karmaRepository'
import { createAttachmentRepository } from '../db/repositories/attachmentRepository'
import { notificationService } from '../services/notificationService'
import { parseDateWithRecurrence } from '../services/dateParser'
import { evaluateFilter, createFilterContext } from '../services/filterEngine'
import { calculateNextDueDate } from '../services/recurrenceEngine'
import { exportToJSON, exportToCSV, importFromJSON, importFromCSV } from '../services/dataExport'
import { KarmaEngine } from '../services/karmaEngine'
import {
  taskUndoStack,
  getUndoAction,
  getRedoAction
} from '../services/undoRedo'
import type { Task, TaskCreate, TaskUpdate, CommentCreate, CommentUpdate } from '@shared/types'

// Lazy-initialized repository singletons
let taskRepo: TaskRepository | null = null
let projectRepo: ProjectRepository | null = null
let labelRepo: LabelRepository | null = null
let sectionRepo: SectionRepository | null = null
let filterRepo: FilterRepository | null = null
let commentRepo: CommentRepository | null = null
let reminderRepo: ReminderRepository | null = null
let karmaRepo: KarmaRepository | null = null
let karmaEngine: KarmaEngine | null = null

function getRepositories() {
  const db = getDatabase()
  if (!taskRepo) taskRepo = new TaskRepository(db)
  if (!projectRepo) projectRepo = new ProjectRepository(db)
  if (!labelRepo) labelRepo = new LabelRepository(db)
  if (!sectionRepo) sectionRepo = new SectionRepository(db)
  if (!filterRepo) filterRepo = new FilterRepository(db)
  if (!commentRepo) commentRepo = new CommentRepository(db)
  if (!reminderRepo) reminderRepo = new ReminderRepository(db)
  if (!karmaRepo) karmaRepo = new KarmaRepository(db)
  if (!karmaEngine) karmaEngine = new KarmaEngine(karmaRepo)
  return { taskRepo, projectRepo, labelRepo, sectionRepo, filterRepo, commentRepo, reminderRepo, karmaRepo, karmaEngine }
}

export function registerIpcHandlers(): void {
  // Task handlers
  ipcMain.handle('tasks:list', async (_event, filter) => {
    const { taskRepo } = getRepositories()
    return taskRepo.list(filter)
  })

  ipcMain.handle('tasks:get', async (_event, id: string) => {
    const { taskRepo } = getRepositories()
    return taskRepo.get(id)
  })

  ipcMain.handle('tasks:create', async (_event, data: TaskCreate, recordUndo: boolean = true) => {
    const { taskRepo } = getRepositories()

    // Parse natural language date if provided as string
    if (typeof data.dueDate === 'string') {
      const { date, recurrence } = parseDateWithRecurrence(data.dueDate)
      data.dueDate = date?.timestamp ?? null
      if (recurrence && !data.recurrenceRule) {
        data.recurrenceRule = recurrence
      }
    }

    const task = taskRepo.create(data)

    // Record operation for undo
    if (recordUndo) {
      taskUndoStack.push({
        type: 'create',
        taskId: task.id,
        data,
        timestamp: Date.now()
      })
    }

    return task
  })

  ipcMain.handle('tasks:update', async (_event, id: string, data: TaskUpdate, recordUndo: boolean = true) => {
    const { taskRepo } = getRepositories()

    // Get previous state for undo
    const previousTask = recordUndo ? taskRepo.get(id) : null

    // Parse natural language date if provided as string
    if (typeof data.dueDate === 'string') {
      const { date, recurrence } = parseDateWithRecurrence(data.dueDate)
      data.dueDate = date?.timestamp ?? null
      if (recurrence && data.recurrenceRule === undefined) {
        data.recurrenceRule = recurrence
      }
    }

    const task = taskRepo.update(id, data)

    // Record operation for undo
    if (recordUndo && previousTask) {
      taskUndoStack.push({
        type: 'update',
        taskId: id,
        data,
        previousData: previousTask,
        timestamp: Date.now()
      })
    }

    return task
  })

  ipcMain.handle('tasks:delete', async (_event, id: string, recordUndo: boolean = true) => {
    const { taskRepo } = getRepositories()

    // Get task data for potential undo
    const task = recordUndo ? taskRepo.get(id) : null

    const result = taskRepo.delete(id)

    // Record operation for undo (store full task data for restoration)
    if (recordUndo && task) {
      taskUndoStack.push({
        type: 'delete',
        taskId: id,
        data: task,
        timestamp: Date.now()
      })
    }

    return result
  })

  ipcMain.handle('tasks:complete', async (_event, id: string, recordUndo: boolean = true) => {
    const { taskRepo, karmaEngine } = getRepositories()

    // Get task before completing to check for recurrence
    const taskBeforeComplete = taskRepo.get(id)

    const task = taskRepo.complete(id)

    // Track karma points for task completion
    if (task) {
      karmaEngine.recordTaskCompletion(task)
    }

    // Handle recurring tasks - create next occurrence
    if (taskBeforeComplete?.recurrenceRule && taskBeforeComplete.dueDate) {
      const completedAt = Date.now()
      const nextDueDate = calculateNextDueDate(
        taskBeforeComplete.recurrenceRule,
        taskBeforeComplete.dueDate,
        completedAt
      )

      if (nextDueDate) {
        // Uncomplete the task and set the next due date
        taskRepo.uncomplete(id)
        taskRepo.update(id, { dueDate: nextDueDate })

        // Record undo for recurring completion with previous due date
        if (recordUndo) {
          taskUndoStack.push({
            type: 'recurring-complete',
            taskId: id,
            data: { previousDueDate: taskBeforeComplete.dueDate },
            timestamp: Date.now()
          })
        }

        // Return the updated (uncompleted, rescheduled) task
        return taskRepo.get(id)
      }
    }

    if (recordUndo) {
      taskUndoStack.push({
        type: 'complete',
        taskId: id,
        data: {},
        timestamp: Date.now()
      })
    }

    return task
  })

  ipcMain.handle('tasks:uncomplete', async (_event, id: string, recordUndo: boolean = true) => {
    const { taskRepo, karmaEngine } = getRepositories()

    // Get task before uncompleting for karma tracking
    const taskBefore = taskRepo.get(id)

    const task = taskRepo.uncomplete(id)

    // Track karma points for task uncompletion
    if (taskBefore) {
      karmaEngine.recordTaskUncompletion(taskBefore)
    }

    if (recordUndo) {
      taskUndoStack.push({
        type: 'uncomplete',
        taskId: id,
        data: {},
        timestamp: Date.now()
      })
    }

    return task
  })

  ipcMain.handle('tasks:reorder', async (_event, taskId: string, newOrder: number, newParentId?: string | null) => {
    const { taskRepo } = getRepositories()

    // Get previous state
    const previousTask = taskRepo.get(taskId)

    const result = taskRepo.reorder(taskId, newOrder, newParentId)

    if (previousTask) {
      taskUndoStack.push({
        type: 'reorder',
        taskId,
        data: { sortOrder: newOrder, parentId: newParentId },
        previousData: { sortOrder: previousTask.sortOrder, parentId: previousTask.parentId },
        timestamp: Date.now()
      })
    }

    return result
  })

  ipcMain.handle('tasks:getToday', async () => {
    const { taskRepo } = getRepositories()
    return taskRepo.getToday()
  })

  ipcMain.handle('tasks:getUpcoming', async (_event, days: number = 7) => {
    const { taskRepo } = getRepositories()
    return taskRepo.getUpcoming(days)
  })

  ipcMain.handle('tasks:getOverdue', async () => {
    const { taskRepo } = getRepositories()
    return taskRepo.getOverdue()
  })

  ipcMain.handle('tasks:search', async (_event, query: string) => {
    const { taskRepo } = getRepositories()
    return taskRepo.search(query)
  })

  ipcMain.handle('tasks:getLabels', async (_event, taskId: string) => {
    const { taskRepo } = getRepositories()
    return taskRepo.getLabels(taskId)
  })

  ipcMain.handle('tasks:getByLabel', async (_event, labelId: string) => {
    const { taskRepo } = getRepositories()
    return taskRepo.list({ labelId, completed: false })
  })

  // Project handlers
  ipcMain.handle('projects:list', async () => {
    const { projectRepo } = getRepositories()
    return projectRepo.list()
  })

  ipcMain.handle('projects:get', async (_event, id: string) => {
    const { projectRepo } = getRepositories()
    return projectRepo.get(id)
  })

  ipcMain.handle('projects:create', async (_event, data) => {
    const { projectRepo } = getRepositories()
    return projectRepo.create(data)
  })

  ipcMain.handle('projects:update', async (_event, id: string, data) => {
    const { projectRepo } = getRepositories()
    return projectRepo.update(id, data)
  })

  ipcMain.handle('projects:delete', async (_event, id: string) => {
    const { projectRepo } = getRepositories()
    return projectRepo.delete(id)
  })

  ipcMain.handle('projects:reorder', async (_event, projectId: string, newOrder: number) => {
    const { projectRepo } = getRepositories()
    return projectRepo.reorder(projectId, newOrder)
  })

  ipcMain.handle('projects:duplicate', async (_event, id: string) => {
    const { projectRepo, sectionRepo, taskRepo } = getRepositories()

    // Get original project
    const original = projectRepo.get(id)
    if (!original) return null

    // Create duplicated project
    const newProject = projectRepo.create({
      name: `${original.name} (copy)`,
      color: original.color,
      parentId: original.parentId,
      viewMode: original.viewMode,
      isFavorite: false
    })

    // Duplicate sections
    const sections = sectionRepo.list(id)
    const sectionIdMap = new Map<string, string>()
    for (const section of sections) {
      const newSection = sectionRepo.create({
        name: section.name,
        projectId: newProject.id
      })
      sectionIdMap.set(section.id, newSection.id)
    }

    // Duplicate ALL tasks (including completed ones) with labels
    const tasks = taskRepo.list({ projectId: id })
    const taskIdMap = new Map<string, string>()

    // Process tasks level by level for correct parent mapping
    // Start with top-level tasks, then children, etc.
    let currentLevel = tasks.filter((t) => !t.parentId)
    while (currentLevel.length > 0) {
      const nextLevel: typeof tasks = []
      for (const task of currentLevel) {
        const newParentId = task.parentId ? taskIdMap.get(task.parentId) : undefined
        // Skip if parent wasn't mapped (shouldn't happen with level-by-level)
        if (task.parentId && !newParentId) continue

        // Get labels for this task
        const labels = taskRepo.getLabels(task.id)
        const labelIds = labels.map(l => l.id)

        const newTask = taskRepo.create({
          content: task.content,
          description: task.description,
          projectId: newProject.id,
          sectionId: task.sectionId ? sectionIdMap.get(task.sectionId) : null,
          parentId: newParentId || null,
          dueDate: task.dueDate,
          deadline: task.deadline,
          duration: task.duration,
          recurrenceRule: task.recurrenceRule,
          priority: task.priority,
          labelIds: labelIds.length > 0 ? labelIds : undefined
        })
        taskIdMap.set(task.id, newTask.id)

        // If original was completed, complete the duplicate too
        if (task.completed) {
          taskRepo.complete(newTask.id)
        }

        // Find children of this task for the next level
        const children = tasks.filter(t => t.parentId === task.id)
        nextLevel.push(...children)
      }
      currentLevel = nextLevel
    }

    return newProject
  })

  // Label handlers
  ipcMain.handle('labels:list', async () => {
    const { labelRepo } = getRepositories()
    return labelRepo.list()
  })

  ipcMain.handle('labels:get', async (_event, id: string) => {
    const { labelRepo } = getRepositories()
    return labelRepo.get(id)
  })

  ipcMain.handle('labels:create', async (_event, data) => {
    const { labelRepo } = getRepositories()
    return labelRepo.create(data)
  })

  ipcMain.handle('labels:update', async (_event, id: string, data) => {
    const { labelRepo } = getRepositories()
    return labelRepo.update(id, data)
  })

  ipcMain.handle('labels:delete', async (_event, id: string) => {
    const { labelRepo } = getRepositories()
    return labelRepo.delete(id)
  })

  // Section handlers
  ipcMain.handle('sections:list', async (_event, projectId: string) => {
    const { sectionRepo } = getRepositories()
    return sectionRepo.list(projectId)
  })

  ipcMain.handle('sections:listAll', async () => {
    const { sectionRepo } = getRepositories()
    return sectionRepo.listAll()
  })

  ipcMain.handle('sections:create', async (_event, data) => {
    const { sectionRepo } = getRepositories()
    return sectionRepo.create(data)
  })

  ipcMain.handle('sections:update', async (_event, id: string, data) => {
    const { sectionRepo } = getRepositories()
    return sectionRepo.update(id, data)
  })

  ipcMain.handle('sections:delete', async (_event, id: string) => {
    const { sectionRepo } = getRepositories()
    return sectionRepo.delete(id)
  })

  ipcMain.handle('sections:reorder', async (_event, sectionId: string, newOrder: number) => {
    const { sectionRepo } = getRepositories()
    return sectionRepo.reorder(sectionId, newOrder)
  })

  // Comment handlers (task comments)
  ipcMain.handle('comments:list', async (_event, taskId: string) => {
    const { commentRepo } = getRepositories()
    return commentRepo.list(taskId)
  })

  ipcMain.handle('comments:listByProject', async (_event, projectId: string) => {
    const { commentRepo } = getRepositories()
    return commentRepo.listByProject(projectId)
  })

  ipcMain.handle('comments:countByProject', async (_event, projectId: string) => {
    const { commentRepo } = getRepositories()
    return commentRepo.countByProject(projectId)
  })

  ipcMain.handle('comments:get', async (_event, id: string) => {
    const { commentRepo } = getRepositories()
    return commentRepo.get(id)
  })

  ipcMain.handle('comments:create', async (_event, data: CommentCreate) => {
    const { commentRepo } = getRepositories()
    return commentRepo.create(data)
  })

  ipcMain.handle('comments:update', async (_event, id: string, data: CommentUpdate) => {
    const { commentRepo } = getRepositories()
    return commentRepo.update(id, data)
  })

  ipcMain.handle('comments:delete', async (_event, id: string) => {
    const { commentRepo } = getRepositories()
    return commentRepo.delete(id)
  })

  ipcMain.handle('comments:count', async (_event, taskId: string) => {
    const { commentRepo } = getRepositories()
    return commentRepo.count(taskId)
  })

  // Filter handlers
  ipcMain.handle('filters:list', async () => {
    const { filterRepo } = getRepositories()
    return filterRepo.list()
  })

  ipcMain.handle('filters:create', async (_event, data) => {
    const { filterRepo } = getRepositories()
    return filterRepo.create(data)
  })

  ipcMain.handle('filters:update', async (_event, id: string, data) => {
    const { filterRepo } = getRepositories()
    return filterRepo.update(id, data)
  })

  ipcMain.handle('filters:delete', async (_event, id: string) => {
    const { filterRepo } = getRepositories()
    return filterRepo.delete(id)
  })

  ipcMain.handle('filters:evaluate', async (_event, query: string) => {
    const { taskRepo, projectRepo, labelRepo, sectionRepo } = getRepositories()

    // Get all tasks and context data
    const tasks = taskRepo.list({ completed: false })
    const projects = projectRepo.list()
    const labels = labelRepo.list()
    // Get all sections from all projects
    const allSections = projects.flatMap((p) => sectionRepo.list(p.id))

    // Populate labels for each task so @label and has:labels filters work
    const tasksWithLabels = tasks.map((t) => ({
      ...t,
      labels: taskRepo.getLabels(t.id)
    }))

    // Create context and evaluate filter
    const context = createFilterContext(projects, labels, allSections)
    return evaluateFilter(tasksWithLabels, query, context)
  })

  // Date parsing handler
  ipcMain.handle('date:parse', async (_event, text: string) => {
    return parseDateWithRecurrence(text)
  })

  // Reminder handlers
  ipcMain.handle('reminders:create', async (_event, data: { taskId: string; remindAt: number }) => {
    const { reminderRepo } = getRepositories()
    return reminderRepo.create(data)
  })

  ipcMain.handle('reminders:getByTask', async (_event, taskId: string) => {
    const { reminderRepo } = getRepositories()
    return reminderRepo.getByTask(taskId)
  })

  ipcMain.handle('reminders:getDue', async () => {
    const { reminderRepo } = getRepositories()
    return reminderRepo.getDue()
  })

  ipcMain.handle('reminders:markNotified', async (_event, id: string) => {
    const { reminderRepo } = getRepositories()
    return reminderRepo.markNotified(id)
  })

  ipcMain.handle('reminders:delete', async (_event, id: string) => {
    const { reminderRepo } = getRepositories()
    return reminderRepo.delete(id)
  })

  // Notification handlers
  ipcMain.handle('notifications:show', async (_event, data: { title: string; body: string }) => {
    notificationService.showNotification(data)
    return true
  })

  ipcMain.handle('notifications:setEnabled', async (_event, enabled: boolean) => {
    notificationService.setEnabled(enabled)
    return true
  })

  ipcMain.handle('notifications:isEnabled', async () => {
    return notificationService.isEnabled()
  })

  // Settings handlers
  ipcMain.handle('settings:get', async (_event, key: string) => {
    const db = getDatabase()
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    stmt.bind([key])
    if (stmt.step()) {
      const result = stmt.getAsObject() as { value: string }
      stmt.free()
      return result.value
    }
    stmt.free()
    return null
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    const db = getDatabase()

    // Check if exists
    const stmt = db.prepare('SELECT key FROM settings WHERE key = ?')
    stmt.bind([key])
    const exists = stmt.step()
    stmt.free()

    if (exists) {
      db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key])
    } else {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value])
    }

    saveDatabase()
    return true
  })

  // Data export/import handlers
  ipcMain.handle('data:exportJSON', async () => {
    const { taskRepo, projectRepo, labelRepo, filterRepo, sectionRepo } = getRepositories()

    const tasks = taskRepo.list({})
    const projects = projectRepo.list()
    const labels = labelRepo.list()
    const filters = filterRepo.list()
    // Get all sections by querying each project
    const sections = projects.flatMap((p) => sectionRepo.list(p.id))

    // Populate labels for each task so export includes label relationships
    const tasksWithLabels = tasks.map((t) => ({
      ...t,
      labels: taskRepo.getLabels(t.id)
    }))

    const json = exportToJSON({ tasks: tasksWithLabels, projects, labels, filters, sections })

    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(window!, {
      title: 'Export Data',
      defaultPath: `todoer-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    writeFileSync(result.filePath, json, 'utf-8')
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('data:exportCSV', async () => {
    const { taskRepo } = getRepositories()
    const tasks = taskRepo.list({})
    const csv = exportToCSV(tasks)

    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(window!, {
      title: 'Export Tasks to CSV',
      defaultPath: `todoer-tasks-${new Date().toISOString().split('T')[0]}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    writeFileSync(result.filePath, csv, 'utf-8')
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('data:importJSON', async () => {
    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(window!, {
      title: 'Import Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      const data = importFromJSON(content)

      const { taskRepo, projectRepo, labelRepo, filterRepo, sectionRepo } = getRepositories()

      // Build old ID -> new ID maps for relational integrity
      const projectIdMap = new Map<string, string>()
      const labelIdMap = new Map<string, string>()
      const sectionIdMap = new Map<string, string>()
      const taskIdMap = new Map<string, string>()

      // Import projects first (tasks may reference them)
      // Sort so parents come before children
      const sortedProjects = [...data.projects].sort((a, b) => {
        if (!a.parentId && b.parentId) return -1
        if (a.parentId && !b.parentId) return 1
        return 0
      })

      let projectsImported = 0
      for (const project of sortedProjects) {
        try {
          const newProject = projectRepo.create({
            name: project.name,
            description: project.description ?? null,
            color: project.color,
            parentId: project.parentId ? projectIdMap.get(project.parentId) || null : null,
            viewMode: project.viewMode ?? 'list',
            isFavorite: project.isFavorite ?? false
          })
          // Handle archived status if it was archived
          if (project.archivedAt) {
            projectRepo.update(newProject.id, { archivedAt: project.archivedAt })
          }
          projectIdMap.set(project.id, newProject.id)
          projectsImported++
        } catch {
          // Skip duplicates
        }
      }

      // Import labels
      let labelsImported = 0
      for (const label of data.labels) {
        try {
          const newLabel = labelRepo.create({
            name: label.name,
            color: label.color,
            isFavorite: label.isFavorite ?? false
          })
          labelIdMap.set(label.id, newLabel.id)
          labelsImported++
        } catch {
          // Skip duplicates
        }
      }

      // Import filters
      let filtersImported = 0
      for (const filter of data.filters) {
        try {
          filterRepo.create({
            name: filter.name,
            query: filter.query,
            color: filter.color,
            isFavorite: filter.isFavorite ?? false
          })
          filtersImported++
        } catch {
          // Skip duplicates
        }
      }

      // Import sections (after projects, before tasks)
      let sectionsImported = 0
      for (const section of data.sections || []) {
        try {
          // Remap project ID for section
          const remappedProjectId = section.projectId
            ? projectIdMap.get(section.projectId) || section.projectId
            : null

          // Skip sections without valid project
          if (!remappedProjectId) continue

          const newSection = sectionRepo.create({
            name: section.name,
            projectId: remappedProjectId
          })
          sectionIdMap.set(section.id, newSection.id)
          sectionsImported++
        } catch {
          // Skip duplicates
        }
      }

      // Import tasks - use topological sort for proper parent ordering
      // Build a dependency map and sort topologically
      const taskMap = new Map(data.tasks.map((t: Task) => [t.id, t]))
      const sortedTasks: Task[] = []
      const visited = new Set<string>()

      function visitTask(task: Task) {
        if (visited.has(task.id)) return
        visited.add(task.id)

        // Visit parent first if it exists
        if (task.parentId && taskMap.has(task.parentId)) {
          visitTask(taskMap.get(task.parentId)!)
        }

        sortedTasks.push(task)
      }

      for (const task of data.tasks) {
        visitTask(task)
      }

      let tasksImported = 0
      for (const task of sortedTasks) {
        try {
          // Remap label IDs using the old->new map
          const remappedLabelIds = (task.labels?.map((l: { id: string }) =>
            labelIdMap.get(l.id) || l.id
          ) || []).filter(Boolean)

          // Remap project ID
          const remappedProjectId = task.projectId
            ? projectIdMap.get(task.projectId) || task.projectId
            : null

          // Remap parent task ID
          const remappedParentId = task.parentId
            ? taskIdMap.get(task.parentId) || null
            : null

          // Remap section ID (or null if section wasn't imported)
          const remappedSectionId = task.sectionId
            ? sectionIdMap.get(task.sectionId) || null
            : null

          const newTask = taskRepo.create({
            content: task.content,
            description: task.description,
            projectId: remappedProjectId,
            sectionId: remappedSectionId,
            parentId: remappedParentId,
            dueDate: task.dueDate,
            deadline: task.deadline ?? null,
            duration: task.duration ?? null,
            priority: task.priority,
            recurrenceRule: task.recurrenceRule,
            labelIds: remappedLabelIds
          })

          // Handle completed state
          if (task.completed) {
            taskRepo.complete(newTask.id)
          }

          taskIdMap.set(task.id, newTask.id)
          tasksImported++
        } catch {
          // Skip duplicates
        }
      }

      return {
        success: true,
        imported: {
          tasks: tasksImported,
          projects: projectsImported,
          labels: labelsImported,
          filters: filtersImported,
          sections: sectionsImported
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('data:importCSV', async () => {
    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(window!, {
      title: 'Import Tasks from CSV',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      const tasks = importFromCSV(content)

      const { taskRepo } = getRepositories()

      let tasksImported = 0
      for (const task of tasks) {
        if (task.content) {
          try {
            taskRepo.create({
              content: task.content,
              description: task.description,
              priority: task.priority,
              dueDate: task.dueDate,
              projectId: task.projectId
            })
            tasksImported++
          } catch (e) {
            // Skip errors
          }
        }
      }

      return { success: true, imported: { tasks: tasksImported } }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Undo/Redo handlers
  ipcMain.handle('undo:canUndo', async () => {
    return taskUndoStack.canUndo()
  })

  ipcMain.handle('undo:canRedo', async () => {
    return taskUndoStack.canRedo()
  })

  ipcMain.handle('undo:undo', async () => {
    const operation = taskUndoStack.undo()
    if (!operation) return { success: false, reason: 'Nothing to undo' }

    const { taskRepo, karmaEngine } = getRepositories()

    try {
      // Handle single operation or batch
      const operations = Array.isArray(operation) ? operation : [operation]

      for (const op of operations.reverse()) {
        const action = getUndoAction(op)

        switch (action.action) {
          case 'create':
            // Undo delete = restore the soft-deleted task
            taskRepo.restore(action.taskId)
            break

          case 'delete':
            taskRepo.delete(action.taskId)
            break

          case 'update':
            if (action.data) {
              taskRepo.update(action.taskId, action.data)
            }
            break

          case 'complete': {
            // Undo uncomplete = complete the task and award karma
            const task = taskRepo.complete(action.taskId)
            if (task) {
              karmaEngine.recordTaskCompletion(task)
            }
            break
          }

          case 'uncomplete': {
            // Undo complete = uncomplete the task and reverse karma
            const taskBefore = taskRepo.get(action.taskId)
            taskRepo.uncomplete(action.taskId)
            if (taskBefore) {
              karmaEngine.recordTaskUncompletion(taskBefore)
            }
            break
          }

          case 'reorder':
            // Use reorder() for proper sort order handling
            if (action.sortOrder !== undefined) {
              taskRepo.reorder(action.taskId, action.sortOrder, action.parentId)
            }
            break

          case 'recurring-complete-undo': {
            // Undo recurring complete = restore previous due date FIRST, then reverse karma
            // Must restore due date before reading task so karma uses the original due date
            if (action.previousDueDate !== undefined) {
              taskRepo.update(action.taskId, { dueDate: action.previousDueDate })
            }
            const taskWithOriginalDate = taskRepo.get(action.taskId)
            if (taskWithOriginalDate) {
              karmaEngine.recordTaskUncompletion(taskWithOriginalDate)
            }
            break
          }
        }
      }

      return { success: true, operation: operations[0].type }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('undo:redo', async () => {
    const operation = taskUndoStack.redo()
    if (!operation) return { success: false, reason: 'Nothing to redo' }

    const { taskRepo, karmaEngine } = getRepositories()

    try {
      // Handle single operation or batch
      const operations = Array.isArray(operation) ? operation : [operation]

      for (const op of operations) {
        const action = getRedoAction(op)

        switch (action.action) {
          case 'create':
            // Redo create = restore the task
            taskRepo.restore(action.taskId)
            break

          case 'delete':
            taskRepo.delete(action.taskId)
            break

          case 'update':
            if (action.data) {
              taskRepo.update(action.taskId, action.data)
            }
            break

          case 'complete': {
            // Redo complete = complete the task and award karma
            const task = taskRepo.complete(action.taskId)
            if (task) {
              karmaEngine.recordTaskCompletion(task)
            }
            break
          }

          case 'uncomplete': {
            // Redo uncomplete = uncomplete the task and reverse karma
            const taskBefore = taskRepo.get(action.taskId)
            taskRepo.uncomplete(action.taskId)
            if (taskBefore) {
              karmaEngine.recordTaskUncompletion(taskBefore)
            }
            break
          }

          case 'reorder':
            // Use reorder() for proper sort order handling
            if (action.sortOrder !== undefined) {
              taskRepo.reorder(action.taskId, action.sortOrder, action.parentId)
            }
            break

          case 'recurring-complete-redo': {
            // Redo recurring complete = complete and reschedule with karma
            const taskBeforeComplete = taskRepo.get(action.taskId)
            const task = taskRepo.complete(action.taskId)

            // Award karma
            if (task) {
              karmaEngine.recordTaskCompletion(task)
            }

            // Handle recurring logic
            if (taskBeforeComplete?.recurrenceRule && taskBeforeComplete.dueDate) {
              const completedAt = Date.now()
              const nextDueDate = calculateNextDueDate(
                taskBeforeComplete.recurrenceRule,
                taskBeforeComplete.dueDate,
                completedAt
              )

              if (nextDueDate) {
                // Uncomplete the task and set the next due date
                taskRepo.uncomplete(action.taskId)
                taskRepo.update(action.taskId, { dueDate: nextDueDate })
              }
            }
            break
          }
        }
      }

      return { success: true, operation: operations[0].type }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('undo:clear', async () => {
    taskUndoStack.clear()
    return { success: true }
  })

  // Karma handlers
  ipcMain.handle('karma:getStats', async () => {
    const { karmaEngine } = getRepositories()
    return karmaEngine.getStats()
  })

  ipcMain.handle('karma:updateGoals', async (_event, data: { dailyGoal?: number; weeklyGoal?: number }) => {
    const { karmaEngine } = getRepositories()
    return karmaEngine.updateGoals(data.dailyGoal, data.weeklyGoal)
  })

  ipcMain.handle('karma:getTodayStats', async () => {
    const { karmaEngine } = getRepositories()
    return karmaEngine.getTodayStats()
  })

  ipcMain.handle('karma:getWeekStats', async () => {
    const { karmaEngine } = getRepositories()
    return karmaEngine.getWeekStats()
  })

  ipcMain.handle('karma:getHistory', async (_event, startDate: string, endDate: string) => {
    const { karmaEngine } = getRepositories()
    return karmaEngine.getHistory(startDate, endDate)
  })

  ipcMain.handle('karma:getProductivitySummary', async () => {
    const { karmaEngine } = getRepositories()
    return karmaEngine.getProductivitySummary()
  })

  // Attachment handlers
  ipcMain.handle('attachments:list', async (_event, taskId: string) => {
    const db = getDatabase()
    const repo = createAttachmentRepository(db)
    return repo.listByTask(taskId)
  })

  ipcMain.handle('attachments:get', async (_event, id: string) => {
    const db = getDatabase()
    const repo = createAttachmentRepository(db)
    return repo.get(id)
  })

  ipcMain.handle('attachments:add', async (_event, taskId: string) => {
    const db = getDatabase()
    const repo = createAttachmentRepository(db)

    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'unnamed'
    const data = readFileSync(filePath)

    // Detect mime type from extension
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const mimeTypes: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', pdf: 'application/pdf', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json'
    }
    const mimeType = mimeTypes[ext] || 'application/octet-stream'

    return repo.add(taskId, filename, mimeType, Buffer.from(data))
  })

  ipcMain.handle('attachments:delete', async (_event, id: string) => {
    const db = getDatabase()
    const repo = createAttachmentRepository(db)
    return repo.delete(id)
  })

  ipcMain.handle('attachments:download', async (_event, id: string) => {
    const db = getDatabase()
    const repo = createAttachmentRepository(db)
    const attachment = repo.get(id)
    if (!attachment) return false

    const result = await dialog.showSaveDialog({
      defaultPath: attachment.filename
    })

    if (result.canceled || !result.filePath) return false

    writeFileSync(result.filePath, attachment.data)
    return true
  })

  ipcMain.handle('attachments:open', async (_event, id: string) => {
    const db = getDatabase()
    const repo = createAttachmentRepository(db)
    const attachment = repo.get(id)
    if (!attachment) return false

    // Save to temp directory and open with system default application
    const tempDir = join(tmpdir(), 'todoer-attachments')
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }
    const tempPath = join(tempDir, attachment.filename)
    writeFileSync(tempPath, attachment.data)

    await shell.openPath(tempPath)
    return true
  })

  ipcMain.handle('attachments:count', async (_event, taskId: string) => {
    const db = getDatabase()
    const repo = createAttachmentRepository(db)
    return repo.count(taskId)
  })
}
