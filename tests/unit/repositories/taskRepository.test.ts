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
      deleted_at INTEGER,
      delegated_to TEXT
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

    it('should reject empty or whitespace-only content', () => {
      expect(() => repo.create({ content: '' })).toThrow(/task content cannot be empty/i)
      expect(() => repo.create({ content: '   ' })).toThrow(/task content cannot be empty/i)
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

    it('should clear description when set to null', () => {
      const task = repo.create({ content: 'Task', description: 'Has a description' })
      expect(task.description).toBe('Has a description')

      const updated = repo.update(task.id, { description: null })
      expect(updated!.description).toBeNull()
    })

    it('should not clear description when undefined is passed', () => {
      const task = repo.create({ content: 'Task', description: 'Keep me' })

      const updated = repo.update(task.id, { content: 'New content' })
      expect(updated!.description).toBe('Keep me')
    })

    it('should return null for non-existent task', () => {
      const result = repo.update('non-existent', { content: 'Test' })
      expect(result).toBeNull()
    })

    it('should reject updating to empty or whitespace-only content', () => {
      const task = repo.create({ content: 'Task' })

      expect(() => repo.update(task.id, { content: '' })).toThrow(/task content cannot be empty/i)
      expect(() => repo.update(task.id, { content: '   ' })).toThrow(/task content cannot be empty/i)
      expect(repo.get(task.id)?.content).toBe('Task')
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

    it('should include deeply nested descendants of due-today tasks', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      const parent = repo.create({ content: 'Grandparent due today', dueDate: today.getTime() })
      const child = repo.create({ content: 'Child no date', parentId: parent.id })
      repo.create({ content: 'Grandchild no date', parentId: child.id })

      const todayTasks = repo.getToday()
      expect(todayTasks.some((t) => t.content === 'Grandparent due today')).toBe(true)
      expect(todayTasks.some((t) => t.content === 'Child no date')).toBe(true)
      expect(todayTasks.some((t) => t.content === 'Grandchild no date')).toBe(true)
    })

    it('should include deeply nested descendants of overdue tasks', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const parent = repo.create({ content: 'Grandparent overdue', dueDate: yesterday.getTime() })
      const child = repo.create({ content: 'Child of overdue', parentId: parent.id })
      repo.create({ content: 'Grandchild of overdue', parentId: child.id })

      const todayTasks = repo.getToday()
      expect(todayTasks.some((t) => t.content === 'Grandparent overdue')).toBe(true)
      expect(todayTasks.some((t) => t.content === 'Child of overdue')).toBe(true)
      expect(todayTasks.some((t) => t.content === 'Grandchild of overdue')).toBe(true)
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

  describe('recursive delete/restore', () => {
    it('should delete grandchildren when deleting a parent task', () => {
      const parent = repo.create({ content: 'Parent' })
      const child = repo.create({ content: 'Child', parentId: parent.id })
      repo.create({ content: 'Grandchild', parentId: child.id })

      repo.delete(parent.id)

      const all = repo.list({})
      expect(all).toHaveLength(0)
    })

    it('should restore grandchildren when restoring a parent task', () => {
      const parent = repo.create({ content: 'Parent' })
      const child = repo.create({ content: 'Child', parentId: parent.id })
      repo.create({ content: 'Grandchild', parentId: child.id })

      repo.delete(parent.id)
      expect(repo.list({})).toHaveLength(0)

      repo.restore(parent.id)
      const all = repo.list({})
      expect(all).toHaveLength(3)
    })

    it('should handle deeply nested task deletion', () => {
      const t1 = repo.create({ content: 'Level 1' })
      const t2 = repo.create({ content: 'Level 2', parentId: t1.id })
      const t3 = repo.create({ content: 'Level 3', parentId: t2.id })
      repo.create({ content: 'Level 4', parentId: t3.id })

      repo.delete(t1.id)

      const all = repo.list({})
      expect(all).toHaveLength(0)
    })
  })

  describe('referential integrity', () => {
    it('should reject create with non-existent projectId', () => {
      expect(() => repo.create({ content: 'Test', projectId: 'nonexistent-project' }))
        .toThrow(/project.*not found/i)
    })

    it('should reject update with non-existent projectId', () => {
      const task = repo.create({ content: 'Test' })
      expect(() => repo.update(task.id, { projectId: 'nonexistent-project' }))
        .toThrow(/project.*not found/i)
    })

    it('should allow create with valid projectId', () => {
      // inbox project is seeded in test DB
      const task = repo.create({ content: 'Test', projectId: 'inbox' })
      expect(task.projectId).toBe('inbox')
    })

    it('should allow null projectId (defaults to inbox)', () => {
      const task = repo.create({ content: 'Test' })
      expect(task.projectId).toBe('inbox')
    })

    it('should reject create with non-existent parentId', () => {
      expect(() => repo.create({ content: 'Subtask', parentId: 'nonexistent-task' }))
        .toThrow(/parent task.*not found/i)
    })

    it('should reject create with non-existent sectionId', () => {
      expect(() => repo.create({ content: 'Task', sectionId: 'missing-section' }))
        .toThrow(/section.*not found/i)
    })

    it('should reject create when section does not belong to task project', () => {
      const projectA = 'project-a'
      const projectB = 'project-b'
      db.run(
        `INSERT INTO projects (id, name, color, sort_order, view_mode, is_favorite, created_at)
         VALUES (?, ?, '#ff0000', 1, 'list', 0, ?)`,
        [projectA, 'Project A', Date.now()]
      )
      db.run(
        `INSERT INTO projects (id, name, color, sort_order, view_mode, is_favorite, created_at)
         VALUES (?, ?, '#00ff00', 2, 'list', 0, ?)`,
        [projectB, 'Project B', Date.now()]
      )
      db.run(
        `INSERT INTO sections (id, name, project_id, sort_order, is_collapsed, created_at)
         VALUES (?, ?, ?, 1, 0, ?)`,
        ['section-b', 'Section B', projectB, Date.now()]
      )

      expect(() =>
        repo.create({
          content: 'Mismatched section',
          projectId: projectA,
          sectionId: 'section-b'
        })
      ).toThrow(/section.*does not belong to project/i)
    })

    it('should reject create with non-existent labelIds', () => {
      expect(() =>
        repo.create({ content: 'Task with missing label', labelIds: ['missing-label'] })
      ).toThrow(/label.*not found/i)
    })

    it('should reject update with non-existent sectionId', () => {
      const task = repo.create({ content: 'Task' })
      expect(() => repo.update(task.id, { sectionId: 'missing-section' }))
        .toThrow(/section.*not found/i)
    })

    it('should reject update that would leave section on a different project', () => {
      const projectA = 'project-a-update'
      const projectB = 'project-b-update'
      db.run(
        `INSERT INTO projects (id, name, color, sort_order, view_mode, is_favorite, created_at)
         VALUES (?, ?, '#aabbcc', 3, 'list', 0, ?)`,
        [projectA, 'Project A Update', Date.now()]
      )
      db.run(
        `INSERT INTO projects (id, name, color, sort_order, view_mode, is_favorite, created_at)
         VALUES (?, ?, '#ccbbaa', 4, 'list', 0, ?)`,
        [projectB, 'Project B Update', Date.now()]
      )
      db.run(
        `INSERT INTO sections (id, name, project_id, sort_order, is_collapsed, created_at)
         VALUES (?, ?, ?, 1, 0, ?)`,
        ['section-a-update', 'Section A', projectA, Date.now()]
      )

      const task = repo.create({
        content: 'Task',
        projectId: projectA,
        sectionId: 'section-a-update'
      })

      expect(() => repo.update(task.id, { projectId: projectB }))
        .toThrow(/section.*does not belong to project/i)
    })

    it('should reject update with non-existent labelIds', () => {
      const task = repo.create({ content: 'Task' })
      expect(() => repo.update(task.id, { labelIds: ['missing-label'] }))
        .toThrow(/label.*not found/i)
    })

    it('should reject reorder when new parent does not exist', () => {
      const task = repo.create({ content: 'Task' })
      expect(() => repo.reorder(task.id, 1, 'missing-parent'))
        .toThrow(/parent task.*not found/i)
    })

    it('should reject reorder when setting task as its own parent', () => {
      const task = repo.create({ content: 'Task' })
      expect(() => repo.reorder(task.id, 1, task.id))
        .toThrow(/cannot be its own parent/i)
    })

    it('should reject reorder when new parent is a descendant (cycle)', () => {
      const parent = repo.create({ content: 'Parent' })
      const child = repo.create({ content: 'Child', parentId: parent.id })
      const grandchild = repo.create({ content: 'Grandchild', parentId: child.id })

      expect(() => repo.reorder(parent.id, 1, grandchild.id))
        .toThrow(/descendant/i)
    })

    it('should survive cyclic data in getDescendantIds without infinite recursion', () => {
      // Create two tasks normally
      const t1 = repo.create({ content: 'Task A' })
      const t2 = repo.create({ content: 'Task B', parentId: t1.id })

      // Manually introduce cycle via raw SQL (bypassing validations)
      db.run('UPDATE tasks SET parent_id = ? WHERE id = ?', [t2.id, t1.id])

      // Delete should not hang or throw stack overflow - cycle detection should stop it
      expect(() => repo.delete(t1.id)).not.toThrow()
    })
  })

  describe('delegatedTo', () => {
    it('should create a task with delegatedTo', () => {
      const task = repo.create({ content: 'Delegated task', delegatedTo: 'Alice' })
      expect(task.delegatedTo).toBe('Alice')
    })

    it('should default delegatedTo to null', () => {
      const task = repo.create({ content: 'Normal task' })
      expect(task.delegatedTo).toBeNull()
    })

    it('should update delegatedTo', () => {
      const task = repo.create({ content: 'Task' })
      const updated = repo.update(task.id, { delegatedTo: 'Bob' })
      expect(updated?.delegatedTo).toBe('Bob')
    })

    it('should clear delegatedTo with null', () => {
      const task = repo.create({ content: 'Task', delegatedTo: 'Alice' })
      const updated = repo.update(task.id, { delegatedTo: null })
      expect(updated?.delegatedTo).toBeNull()
    })

    it('should list delegated users', () => {
      repo.create({ content: 'Task 1', delegatedTo: 'Alice' })
      repo.create({ content: 'Task 2', delegatedTo: 'Bob' })
      repo.create({ content: 'Task 3', delegatedTo: 'Alice' })
      repo.create({ content: 'Task 4' })

      const users = repo.listDelegatedUsers()
      expect(users).toHaveLength(2)
      expect(users).toContain('Alice')
      expect(users).toContain('Bob')
    })

    it('should not include deleted tasks in delegated users', () => {
      const task = repo.create({ content: 'Task', delegatedTo: 'Charlie' })
      repo.delete(task.id)

      const users = repo.listDelegatedUsers()
      expect(users).not.toContain('Charlie')
    })

    it('should preserve delegatedTo in get', () => {
      const task = repo.create({ content: 'Task', delegatedTo: 'Diana' })
      const fetched = repo.get(task.id)
      expect(fetched?.delegatedTo).toBe('Diana')
    })
  })
})
