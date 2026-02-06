import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { TaskRepository } from '@main/db/repositories/taskRepository'
import { INBOX_PROJECT_ID } from '@shared/constants'

let SQL: Awaited<ReturnType<typeof initSqlJs>>

async function createTestDb(): Promise<SqlJsDatabase> {
  if (!SQL) {
    SQL = await initSqlJs()
  }

  const db = new SQL.Database()

  // Create schema
  db.run(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#808080',
      parent_id TEXT,
      sort_order REAL NOT NULL,
      view_mode TEXT NOT NULL DEFAULT 'list',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE sections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project_id TEXT NOT NULL,
      sort_order REAL NOT NULL,
      is_collapsed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#808080',
      sort_order REAL NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      description TEXT,
      project_id TEXT,
      section_id TEXT,
      parent_id TEXT,
      due_date INTEGER,
      deadline INTEGER,
      duration INTEGER,
      recurrence_rule TEXT,
      priority INTEGER NOT NULL DEFAULT 4,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      sort_order REAL NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE task_labels (
      task_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      PRIMARY KEY (task_id, label_id)
    );

    INSERT INTO projects (id, name, color, sort_order, view_mode, is_favorite, created_at)
    VALUES ('inbox', 'Inbox', '#246fe0', 0, 'list', 0, ${Date.now()});
  `)

  return db
}

describe('TaskRepository', () => {
  let db: SqlJsDatabase
  let repo: TaskRepository

  beforeEach(async () => {
    db = await createTestDb()
    repo = new TaskRepository(db)
  })

  describe('create', () => {
    it('should create a task with content', () => {
      const task = repo.create({ content: 'Test task' })

      expect(task).toBeDefined()
      expect(task.id).toBeDefined()
      expect(task.content).toBe('Test task')
      expect(task.completed).toBe(false)
      expect(task.priority).toBe(4)
      expect(task.projectId).toBe(INBOX_PROJECT_ID)
    })

    it('should create a task with priority', () => {
      const task = repo.create({ content: 'Urgent task', priority: 1 })

      expect(task.priority).toBe(1)
    })

    it('should create a task with due date', () => {
      const dueDate = Date.now() + 86400000 // Tomorrow
      const task = repo.create({ content: 'Due task', dueDate })

      expect(task.dueDate).toBe(dueDate)
    })

    it('should create a task with description', () => {
      const task = repo.create({
        content: 'Task with description',
        description: 'This is the description'
      })

      expect(task.description).toBe('This is the description')
    })

    it('should create a subtask', () => {
      const parent = repo.create({ content: 'Parent task' })
      const child = repo.create({ content: 'Child task', parentId: parent.id })

      expect(child.parentId).toBe(parent.id)
    })

    it('should auto-increment sort order', () => {
      const task1 = repo.create({ content: 'First' })
      const task2 = repo.create({ content: 'Second' })
      const task3 = repo.create({ content: 'Third' })

      expect(task1.sortOrder).toBeLessThan(task2.sortOrder)
      expect(task2.sortOrder).toBeLessThan(task3.sortOrder)
    })
  })

  describe('get', () => {
    it('should retrieve a task by ID', () => {
      const created = repo.create({ content: 'Test task' })
      const retrieved = repo.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.content).toBe('Test task')
    })

    it('should return null for non-existent task', () => {
      const result = repo.get('non-existent-id')
      expect(result).toBeNull()
    })

    it('should not return deleted tasks', () => {
      const task = repo.create({ content: 'To delete' })
      repo.delete(task.id)

      const result = repo.get(task.id)
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('should list all tasks', () => {
      repo.create({ content: 'Task 1' })
      repo.create({ content: 'Task 2' })
      repo.create({ content: 'Task 3' })

      const tasks = repo.list()
      expect(tasks).toHaveLength(3)
    })

    it('should filter by project', () => {
      // Create a project first
      db.run(`INSERT INTO projects (id, name, color, sort_order, view_mode, is_favorite, created_at)
              VALUES ('project1', 'Project 1', '#ff0000', 1, 'list', 0, ${Date.now()})`)

      repo.create({ content: 'Inbox task' })
      repo.create({ content: 'Project task', projectId: 'project1' })

      const inboxTasks = repo.list({ projectId: INBOX_PROJECT_ID })
      expect(inboxTasks).toHaveLength(1)
      expect(inboxTasks[0].content).toBe('Inbox task')

      const projectTasks = repo.list({ projectId: 'project1' })
      expect(projectTasks).toHaveLength(1)
      expect(projectTasks[0].content).toBe('Project task')
    })

    it('should filter by completion status', () => {
      const task1 = repo.create({ content: 'Incomplete' })
      const task2 = repo.create({ content: 'Complete' })
      repo.complete(task2.id)

      const incomplete = repo.list({ completed: false })
      expect(incomplete).toHaveLength(1)
      expect(incomplete[0].content).toBe('Incomplete')

      const complete = repo.list({ completed: true })
      expect(complete).toHaveLength(1)
      expect(complete[0].content).toBe('Complete')
    })

    it('should exclude deleted tasks by default', () => {
      repo.create({ content: 'Active' })
      const toDelete = repo.create({ content: 'Deleted' })
      repo.delete(toDelete.id)

      const tasks = repo.list()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].content).toBe('Active')
    })

    it('should filter by parent (subtasks)', () => {
      const parent = repo.create({ content: 'Parent' })
      repo.create({ content: 'Child 1', parentId: parent.id })
      repo.create({ content: 'Child 2', parentId: parent.id })
      repo.create({ content: 'Root task' })

      const subtasks = repo.list({ parentId: parent.id })
      expect(subtasks).toHaveLength(2)

      const rootTasks = repo.list({ parentId: null })
      expect(rootTasks).toHaveLength(2) // Parent and Root task
    })
  })

  describe('update', () => {
    it('should update task content', () => {
      const task = repo.create({ content: 'Original' })
      const updated = repo.update(task.id, { content: 'Updated' })

      expect(updated).toBeDefined()
      expect(updated!.content).toBe('Updated')
    })

    it('should update task priority', () => {
      const task = repo.create({ content: 'Task', priority: 4 })
      const updated = repo.update(task.id, { priority: 1 })

      expect(updated!.priority).toBe(1)
    })

    it('should update due date', () => {
      const task = repo.create({ content: 'Task' })
      const newDueDate = Date.now() + 172800000 // 2 days

      const updated = repo.update(task.id, { dueDate: newDueDate })
      expect(updated!.dueDate).toBe(newDueDate)
    })

    it('should update multiple fields at once', () => {
      const task = repo.create({ content: 'Task' })
      const updated = repo.update(task.id, {
        content: 'New content',
        priority: 2,
        description: 'New description'
      })

      expect(updated!.content).toBe('New content')
      expect(updated!.priority).toBe(2)
      expect(updated!.description).toBe('New description')
    })

    it('should return null for non-existent task', () => {
      const result = repo.update('non-existent', { content: 'Test' })
      expect(result).toBeNull()
    })

    it('should update the updatedAt timestamp', () => {
      const task = repo.create({ content: 'Task' })
      const originalUpdatedAt = task.updatedAt

      const updated = repo.update(task.id, { content: 'Updated' })
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('delete', () => {
    it('should soft delete a task', () => {
      const task = repo.create({ content: 'To delete' })
      const result = repo.delete(task.id)

      expect(result).toBe(true)
      expect(repo.get(task.id)).toBeNull()
    })

    it('should return false for non-existent task', () => {
      const result = repo.delete('non-existent')
      expect(result).toBe(false)
    })

    it('should also delete subtasks', () => {
      const parent = repo.create({ content: 'Parent' })
      const child = repo.create({ content: 'Child', parentId: parent.id })

      repo.delete(parent.id)

      expect(repo.get(parent.id)).toBeNull()
      expect(repo.get(child.id)).toBeNull()
    })
  })

  describe('complete/uncomplete', () => {
    it('should mark task as complete', () => {
      const task = repo.create({ content: 'Task' })
      const completed = repo.complete(task.id)

      expect(completed).toBeDefined()
      expect(completed!.completed).toBe(true)
      expect(completed!.completedAt).toBeDefined()
    })

    it('should mark task as incomplete', () => {
      const task = repo.create({ content: 'Task' })
      repo.complete(task.id)
      const uncompleted = repo.uncomplete(task.id)

      expect(uncompleted).toBeDefined()
      expect(uncompleted!.completed).toBe(false)
      expect(uncompleted!.completedAt).toBeNull()
    })

    it('should return null for non-existent task', () => {
      expect(repo.complete('non-existent')).toBeNull()
      expect(repo.uncomplete('non-existent')).toBeNull()
    })
  })

  describe('reorder', () => {
    it('should update sort order', () => {
      const task = repo.create({ content: 'Task' })
      const reordered = repo.reorder(task.id, 5.5)

      expect(reordered).toBeDefined()
      expect(reordered!.sortOrder).toBe(5.5)
    })

    it('should update parent when reordering', () => {
      const parent = repo.create({ content: 'Parent' })
      const task = repo.create({ content: 'Task' })

      const reordered = repo.reorder(task.id, 1, parent.id)

      expect(reordered!.parentId).toBe(parent.id)
    })

    it('should move to root level', () => {
      const parent = repo.create({ content: 'Parent' })
      const child = repo.create({ content: 'Child', parentId: parent.id })

      const reordered = repo.reorder(child.id, 1, null)

      expect(reordered!.parentId).toBeNull()
    })
  })

  describe('getToday', () => {
    it('should return tasks due today', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      repo.create({ content: 'Due today', dueDate: today.getTime() })
      repo.create({ content: 'No due date' })

      const todayTasks = repo.getToday()
      expect(todayTasks.some((t) => t.content === 'Due today')).toBe(true)
    })

    it('should include overdue tasks', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      repo.create({ content: 'Overdue', dueDate: yesterday.getTime() })

      const todayTasks = repo.getToday()
      expect(todayTasks.some((t) => t.content === 'Overdue')).toBe(true)
    })

    it('should not include completed tasks', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      const task = repo.create({ content: 'Completed today', dueDate: today.getTime() })
      repo.complete(task.id)

      const todayTasks = repo.getToday()
      expect(todayTasks).toHaveLength(0)
    })

    it('should include subtasks whose parent is due today', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      const parent = repo.create({ content: 'Parent due today', dueDate: today.getTime() })
      repo.create({ content: 'Subtask no date', parentId: parent.id })

      const todayTasks = repo.getToday()
      expect(todayTasks.some((t) => t.content === 'Parent due today')).toBe(true)
      expect(todayTasks.some((t) => t.content === 'Subtask no date')).toBe(true)
    })

    it('should include subtasks whose parent is overdue', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const parent = repo.create({ content: 'Parent overdue', dueDate: yesterday.getTime() })
      repo.create({ content: 'Subtask of overdue', parentId: parent.id })

      const todayTasks = repo.getToday()
      expect(todayTasks.some((t) => t.content === 'Parent overdue')).toBe(true)
      expect(todayTasks.some((t) => t.content === 'Subtask of overdue')).toBe(true)
    })

    it('should not include subtasks of tasks due in the future', () => {
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)

      const parent = repo.create({ content: 'Parent future', dueDate: nextWeek.getTime() })
      repo.create({ content: 'Subtask of future', parentId: parent.id })

      const todayTasks = repo.getToday()
      expect(todayTasks.some((t) => t.content === 'Subtask of future')).toBe(false)
    })
  })

  describe('getUpcoming', () => {
    it('should return tasks within specified days', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 8)

      repo.create({ content: 'Tomorrow', dueDate: tomorrow.getTime() })
      repo.create({ content: 'Next week', dueDate: nextWeek.getTime() })

      const upcoming = repo.getUpcoming(7)
      expect(upcoming.some((t) => t.content === 'Tomorrow')).toBe(true)
      expect(upcoming.some((t) => t.content === 'Next week')).toBe(false)
    })
  })

  describe('getOverdue', () => {
    it('should return only overdue tasks', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      repo.create({ content: 'Overdue', dueDate: yesterday.getTime() })
      repo.create({ content: 'Future', dueDate: tomorrow.getTime() })

      const overdue = repo.getOverdue()
      expect(overdue).toHaveLength(1)
      expect(overdue[0].content).toBe('Overdue')
    })
  })

  describe('search', () => {
    it('should find tasks by content', () => {
      repo.create({ content: 'Buy groceries' })
      repo.create({ content: 'Call mom' })
      repo.create({ content: 'Buy new phone' })

      const results = repo.search('Buy')
      expect(results).toHaveLength(2)
    })

    it('should find tasks by description', () => {
      repo.create({ content: 'Task', description: 'Important meeting notes' })
      repo.create({ content: 'Another task' })

      const results = repo.search('meeting')
      expect(results).toHaveLength(1)
    })

    it('should be case-insensitive', () => {
      repo.create({ content: 'UPPERCASE TASK' })

      const results = repo.search('uppercase')
      expect(results).toHaveLength(1)
    })

    it('should not return deleted tasks', () => {
      const task = repo.create({ content: 'Deleted task' })
      repo.delete(task.id)

      const results = repo.search('Deleted')
      expect(results).toHaveLength(0)
    })
  })
})
