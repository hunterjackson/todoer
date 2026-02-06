import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'
import { ProjectRepository } from '../../../src/main/db/repositories/projectRepository'
import { TaskRepository } from '../../../src/main/db/repositories/taskRepository'

describe('ProjectRepository', () => {
  let db: Database
  let projectRepo: ProjectRepository
  let taskRepo: TaskRepository

  const createDb = async () => {
    const SQL = await initSqlJs()
    return new SQL.Database()
  }

  beforeEach(async () => {
    db = await createDb()

    // Create tables
    db.run(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#808080',
        parent_id TEXT,
        sort_order REAL DEFAULT 0,
        view_mode TEXT DEFAULT 'list',
        is_favorite INTEGER DEFAULT 0,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        deleted_at INTEGER
      )
    `)

    db.run(`
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
        priority INTEGER DEFAULT 4,
        completed INTEGER DEFAULT 0,
        completed_at INTEGER,
        sort_order REAL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )
    `)

    db.run(`
      CREATE TABLE task_labels (
        task_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        PRIMARY KEY (task_id, label_id)
      )
    `)

    projectRepo = new ProjectRepository(db)
    taskRepo = new TaskRepository(db)
  })

  describe('create', () => {
    it('should create a project with default values', () => {
      const project = projectRepo.create({ name: 'My Project' })

      expect(project.id).toBeDefined()
      expect(project.name).toBe('My Project')
      expect(project.description).toBeNull()
      expect(project.color).toBe('#808080')
      expect(project.viewMode).toBe('list')
      expect(project.isFavorite).toBe(false)
      expect(project.parentId).toBeNull()
      expect(project.archivedAt).toBeNull()
      expect(project.deletedAt).toBeNull()
    })

    it('should create a project with description', () => {
      const project = projectRepo.create({ name: 'Test', description: 'Project description' })

      expect(project.description).toBe('Project description')
    })

    it('should create a project with custom color', () => {
      const project = projectRepo.create({ name: 'Test', color: '#ff0000' })

      expect(project.color).toBe('#ff0000')
    })

    it('should create a project with board view mode', () => {
      const project = projectRepo.create({ name: 'Test', viewMode: 'board' })

      expect(project.viewMode).toBe('board')
    })

    it('should create a favorite project', () => {
      const project = projectRepo.create({ name: 'Test', isFavorite: true })

      expect(project.isFavorite).toBe(true)
    })

    it('should create a subproject', () => {
      const parent = projectRepo.create({ name: 'Parent' })
      const child = projectRepo.create({ name: 'Child', parentId: parent.id })

      expect(child.parentId).toBe(parent.id)
    })

    it('should auto-assign sort order', () => {
      const project1 = projectRepo.create({ name: 'First' })
      const project2 = projectRepo.create({ name: 'Second' })

      expect(project2.sortOrder).toBeGreaterThan(project1.sortOrder)
    })
  })

  describe('get', () => {
    it('should get a project by ID', () => {
      const created = projectRepo.create({ name: 'Test' })

      const retrieved = projectRepo.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe('Test')
    })

    it('should return null for non-existent project', () => {
      const result = projectRepo.get('non-existent')
      expect(result).toBeNull()
    })

    it('should not return deleted projects', () => {
      const project = projectRepo.create({ name: 'Test' })
      projectRepo.delete(project.id)

      const result = projectRepo.get(project.id)
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('should list all projects', () => {
      projectRepo.create({ name: 'Project 1' })
      projectRepo.create({ name: 'Project 2' })

      const projects = projectRepo.list()

      expect(projects).toHaveLength(2)
    })

    it('should return empty array when no projects', () => {
      const projects = projectRepo.list()
      expect(projects).toHaveLength(0)
    })

    it('should not include deleted projects by default', () => {
      const project = projectRepo.create({ name: 'Test' })
      projectRepo.delete(project.id)

      const projects = projectRepo.list()
      expect(projects).toHaveLength(0)
    })

    it('should include deleted projects when requested', () => {
      const project = projectRepo.create({ name: 'Test' })
      projectRepo.delete(project.id)

      const projects = projectRepo.list(true)
      expect(projects).toHaveLength(1)
    })

    it('should order projects by sort_order', () => {
      const p1 = projectRepo.create({ name: 'First' })
      const p2 = projectRepo.create({ name: 'Second' })

      // Manually reorder
      projectRepo.reorder(p2.id, 0.5)
      projectRepo.reorder(p1.id, 1)

      const projects = projectRepo.list()
      expect(projects[0].name).toBe('Second')
      expect(projects[1].name).toBe('First')
    })
  })

  describe('update', () => {
    it('should update project name', () => {
      const project = projectRepo.create({ name: 'Old Name' })

      const updated = projectRepo.update(project.id, { name: 'New Name' })

      expect(updated?.name).toBe('New Name')
    })

    it('should update project color', () => {
      const project = projectRepo.create({ name: 'Test' })

      const updated = projectRepo.update(project.id, { color: '#0000ff' })

      expect(updated?.color).toBe('#0000ff')
    })

    it('should update viewMode', () => {
      const project = projectRepo.create({ name: 'Test' })

      const updated = projectRepo.update(project.id, { viewMode: 'board' })

      expect(updated?.viewMode).toBe('board')
    })

    it('should update isFavorite', () => {
      const project = projectRepo.create({ name: 'Test' })

      expect(project.isFavorite).toBe(false)

      const updated = projectRepo.update(project.id, { isFavorite: true })

      expect(updated?.isFavorite).toBe(true)
    })

    it('should update parentId', () => {
      const parent = projectRepo.create({ name: 'Parent' })
      const project = projectRepo.create({ name: 'Test' })

      const updated = projectRepo.update(project.id, { parentId: parent.id })

      expect(updated?.parentId).toBe(parent.id)
    })

    it('should update archivedAt', () => {
      const project = projectRepo.create({ name: 'Test' })
      const archiveTime = Date.now()

      const updated = projectRepo.update(project.id, { archivedAt: archiveTime })

      expect(updated?.archivedAt).toBe(archiveTime)
    })

    it('should return null for non-existent project', () => {
      const result = projectRepo.update('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should handle update with no changes', () => {
      const project = projectRepo.create({ name: 'Test' })

      const updated = projectRepo.update(project.id, {})

      expect(updated?.name).toBe('Test')
    })
  })

  describe('delete', () => {
    it('should soft delete a project', () => {
      const project = projectRepo.create({ name: 'Test' })

      const result = projectRepo.delete(project.id)

      expect(result).toBe(true)
      expect(projectRepo.get(project.id)).toBeNull()
    })

    it('should return false for non-existent project', () => {
      const result = projectRepo.delete('non-existent')
      expect(result).toBe(false)
    })

    it('should also delete subprojects', () => {
      const parent = projectRepo.create({ name: 'Parent' })
      const child = projectRepo.create({ name: 'Child', parentId: parent.id })

      projectRepo.delete(parent.id)

      expect(projectRepo.get(child.id)).toBeNull()
    })
  })

  describe('reorder', () => {
    it('should update sort order', () => {
      const project = projectRepo.create({ name: 'Test' })

      const updated = projectRepo.reorder(project.id, 5.5)

      expect(updated?.sortOrder).toBe(5.5)
    })

    it('should return null for non-existent project', () => {
      const result = projectRepo.reorder('non-existent', 5)
      expect(result).toBeNull()
    })
  })

  describe('getTaskCount', () => {
    it('should count incomplete tasks in project', () => {
      const project = projectRepo.create({ name: 'Test' })

      taskRepo.create({ content: 'Task 1', projectId: project.id })
      taskRepo.create({ content: 'Task 2', projectId: project.id })
      const task3 = taskRepo.create({ content: 'Task 3', projectId: project.id })
      taskRepo.complete(task3.id)

      const count = projectRepo.getTaskCount(project.id)

      expect(count).toBe(2)
    })

    it('should count all tasks including completed when requested', () => {
      const project = projectRepo.create({ name: 'Test' })

      taskRepo.create({ content: 'Task 1', projectId: project.id })
      const task2 = taskRepo.create({ content: 'Task 2', projectId: project.id })
      taskRepo.complete(task2.id)

      const count = projectRepo.getTaskCount(project.id, true)

      expect(count).toBe(2)
    })

    it('should return 0 for project with no tasks', () => {
      const project = projectRepo.create({ name: 'Test' })

      const count = projectRepo.getTaskCount(project.id)

      expect(count).toBe(0)
    })

    it('should not count deleted tasks', () => {
      const project = projectRepo.create({ name: 'Test' })

      taskRepo.create({ content: 'Task 1', projectId: project.id })
      const task2 = taskRepo.create({ content: 'Task 2', projectId: project.id })
      taskRepo.delete(task2.id)

      const count = projectRepo.getTaskCount(project.id)

      expect(count).toBe(1)
    })
  })

  describe('duplication fidelity', () => {
    it('should include completed tasks in task list for duplication', () => {
      const project = projectRepo.create({ name: 'Test' })
      taskRepo.create({ content: 'Active task', projectId: project.id })
      const completedTask = taskRepo.create({ content: 'Done task', projectId: project.id })
      taskRepo.complete(completedTask.id)

      // When listing ALL tasks (not filtered), both should be present
      const allTasks = taskRepo.list({ projectId: project.id })
      expect(allTasks.some(t => t.content === 'Active task')).toBe(true)
      expect(allTasks.some(t => t.content === 'Done task')).toBe(true)
    })
  })

  describe('recursive delete', () => {
    it('should delete grandchild subprojects when deleting a parent', () => {
      const parent = projectRepo.create({ name: 'Parent' })
      const child = projectRepo.create({ name: 'Child', parentId: parent.id })
      projectRepo.create({ name: 'Grandchild', parentId: child.id })

      projectRepo.delete(parent.id)

      // All three should be soft-deleted
      const all = projectRepo.list()
      const nonInbox = all.filter(p => p.id !== 'inbox')
      expect(nonInbox).toHaveLength(0)
    })

    it('should move tasks from grandchild subprojects to Inbox on delete', () => {
      const parent = projectRepo.create({ name: 'Parent' })
      const child = projectRepo.create({ name: 'Child', parentId: parent.id })
      const grandchild = projectRepo.create({ name: 'Grandchild', parentId: child.id })

      taskRepo.create({ content: 'Task in grandchild', projectId: grandchild.id })

      projectRepo.delete(parent.id)

      // Task should have been moved to Inbox
      const inboxTasks = taskRepo.list({ projectId: 'inbox' })
      expect(inboxTasks.some(t => t.content === 'Task in grandchild')).toBe(true)
    })
  })
})
