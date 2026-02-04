import { ipcMain, dialog, BrowserWindow } from 'electron'
import { Database as SqlJsDatabase } from 'sql.js'
import { writeFileSync, readFileSync } from 'fs'
import { getDatabase } from '../db'
import { TaskRepository } from '../db/repositories/taskRepository'
import { ProjectRepository } from '../db/repositories/projectRepository'
import { LabelRepository } from '../db/repositories/labelRepository'
import { SectionRepository } from '../db/repositories/sectionRepository'
import { FilterRepository } from '../db/repositories/filterRepository'
import { parseDateWithRecurrence } from '../services/dateParser'
import { evaluateFilter, createFilterContext } from '../services/filterEngine'
import { exportToJSON, exportToCSV, importFromJSON, importFromCSV } from '../services/dataExport'
import type { TaskCreate, TaskUpdate } from '@shared/types'

let taskRepo: TaskRepository | null = null
let projectRepo: ProjectRepository | null = null
let labelRepo: LabelRepository | null = null
let sectionRepo: SectionRepository | null = null
let filterRepo: FilterRepository | null = null

function getRepositories() {
  const db = getDatabase()
  if (!taskRepo) taskRepo = new TaskRepository(db)
  if (!projectRepo) projectRepo = new ProjectRepository(db)
  if (!labelRepo) labelRepo = new LabelRepository(db)
  if (!sectionRepo) sectionRepo = new SectionRepository(db)
  if (!filterRepo) filterRepo = new FilterRepository(db)
  return { taskRepo, projectRepo, labelRepo, sectionRepo, filterRepo }
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

  ipcMain.handle('tasks:create', async (_event, data: TaskCreate) => {
    const { taskRepo } = getRepositories()

    // Parse natural language date if provided as string
    if (typeof data.dueDate === 'string') {
      const { date, recurrence } = parseDateWithRecurrence(data.dueDate)
      data.dueDate = date?.timestamp ?? null
      if (recurrence && !data.recurrenceRule) {
        data.recurrenceRule = recurrence
      }
    }

    return taskRepo.create(data)
  })

  ipcMain.handle('tasks:update', async (_event, id: string, data: TaskUpdate) => {
    const { taskRepo } = getRepositories()

    // Parse natural language date if provided as string
    if (typeof data.dueDate === 'string') {
      const { date, recurrence } = parseDateWithRecurrence(data.dueDate)
      data.dueDate = date?.timestamp ?? null
      if (recurrence && data.recurrenceRule === undefined) {
        data.recurrenceRule = recurrence
      }
    }

    return taskRepo.update(id, data)
  })

  ipcMain.handle('tasks:delete', async (_event, id: string) => {
    const { taskRepo } = getRepositories()
    return taskRepo.delete(id)
  })

  ipcMain.handle('tasks:complete', async (_event, id: string) => {
    const { taskRepo } = getRepositories()
    return taskRepo.complete(id)
  })

  ipcMain.handle('tasks:uncomplete', async (_event, id: string) => {
    const { taskRepo } = getRepositories()
    return taskRepo.uncomplete(id)
  })

  ipcMain.handle('tasks:reorder', async (_event, taskId: string, newOrder: number, newParentId?: string | null) => {
    const { taskRepo } = getRepositories()
    return taskRepo.reorder(taskId, newOrder, newParentId)
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
    const { taskRepo, projectRepo, labelRepo } = getRepositories()

    // Get all tasks and context data
    const tasks = taskRepo.list({ completed: false })
    const projects = projectRepo.list()
    const labels = labelRepo.list()

    // Create context and evaluate filter
    const context = createFilterContext(projects, labels)
    return evaluateFilter(tasks, query, context)
  })

  // Date parsing handler
  ipcMain.handle('date:parse', async (_event, text: string) => {
    return parseDateWithRecurrence(text)
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

    return true
  })

  // Data export/import handlers
  ipcMain.handle('data:exportJSON', async () => {
    const { taskRepo, projectRepo, labelRepo, filterRepo } = getRepositories()

    const tasks = taskRepo.list({})
    const projects = projectRepo.list()
    const labels = labelRepo.list()
    const filters = filterRepo.list()

    const json = exportToJSON({ tasks, projects, labels, filters })

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

      const { taskRepo, projectRepo, labelRepo, filterRepo } = getRepositories()

      // Import projects first (tasks may reference them)
      let projectsImported = 0
      for (const project of data.projects) {
        try {
          projectRepo.create({
            name: project.name,
            color: project.color,
            parentId: project.parentId,
            isFavorite: project.isFavorite
          })
          projectsImported++
        } catch (e) {
          // Skip duplicates
        }
      }

      // Import labels
      let labelsImported = 0
      for (const label of data.labels) {
        try {
          labelRepo.create({
            name: label.name,
            color: label.color
          })
          labelsImported++
        } catch (e) {
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
            color: filter.color
          })
          filtersImported++
        } catch (e) {
          // Skip duplicates
        }
      }

      // Import tasks
      let tasksImported = 0
      for (const task of data.tasks) {
        try {
          // Extract label IDs from labels array if present
          const labelIds = task.labels?.map((l) => l.id) || []

          taskRepo.create({
            content: task.content,
            description: task.description,
            projectId: task.projectId,
            sectionId: task.sectionId,
            parentId: task.parentId,
            dueDate: task.dueDate,
            priority: task.priority,
            recurrenceRule: task.recurrenceRule,
            labelIds
          })
          tasksImported++
        } catch (e) {
          // Skip duplicates
        }
      }

      return {
        success: true,
        imported: {
          tasks: tasksImported,
          projects: projectsImported,
          labels: labelsImported,
          filters: filtersImported
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
}
