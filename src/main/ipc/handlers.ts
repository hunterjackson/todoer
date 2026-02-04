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
import {
  taskUndoStack,
  getUndoAction,
  getRedoAction,
  type TaskOperation
} from '../services/undoRedo'
import type { TaskCreate, TaskUpdate, Task } from '@shared/types'

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
    const { taskRepo } = getRepositories()
    const task = taskRepo.complete(id)

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
    const { taskRepo } = getRepositories()
    const task = taskRepo.uncomplete(id)

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

    const { taskRepo } = getRepositories()

    try {
      // Handle single operation or batch
      const operations = Array.isArray(operation) ? operation : [operation]

      for (const op of operations.reverse()) {
        const action = getUndoAction(op)

        switch (action.action) {
          case 'create':
            // Recreate deleted task
            if (action.data) {
              taskRepo.create({
                content: (action.data as Task).content,
                description: (action.data as Task).description,
                projectId: (action.data as Task).projectId,
                sectionId: (action.data as Task).sectionId,
                parentId: (action.data as Task).parentId,
                dueDate: (action.data as Task).dueDate,
                priority: (action.data as Task).priority,
                recurrenceRule: (action.data as Task).recurrenceRule
              })
            }
            break

          case 'delete':
            taskRepo.delete(action.taskId)
            break

          case 'update':
            if (action.data) {
              taskRepo.update(action.taskId, action.data)
            }
            break

          case 'complete':
            taskRepo.complete(action.taskId)
            break

          case 'uncomplete':
            taskRepo.uncomplete(action.taskId)
            break
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

    const { taskRepo } = getRepositories()

    try {
      // Handle single operation or batch
      const operations = Array.isArray(operation) ? operation : [operation]

      for (const op of operations) {
        const action = getRedoAction(op)

        switch (action.action) {
          case 'create':
            if (action.data) {
              taskRepo.create({
                content: (action.data as Task).content || '',
                description: (action.data as Task).description,
                projectId: (action.data as Task).projectId,
                sectionId: (action.data as Task).sectionId,
                parentId: (action.data as Task).parentId,
                dueDate: (action.data as Task).dueDate,
                priority: (action.data as Task).priority,
                recurrenceRule: (action.data as Task).recurrenceRule
              })
            }
            break

          case 'delete':
            taskRepo.delete(action.taskId)
            break

          case 'update':
            if (action.data) {
              taskRepo.update(action.taskId, action.data)
            }
            break

          case 'complete':
            taskRepo.complete(action.taskId)
            break

          case 'uncomplete':
            taskRepo.uncomplete(action.taskId)
            break
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
}
