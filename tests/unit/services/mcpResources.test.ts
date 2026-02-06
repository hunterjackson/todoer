import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    getName: () => 'todoer-test'
  }
}))

import { registerResources, handleResourceRead } from '@main/mcp/resources'
import initSqlJs, { Database } from 'sql.js'
import { TaskRepository } from '@main/db/repositories/taskRepository'
import { ProjectRepository } from '@main/db/repositories/projectRepository'

describe('MCP Resources', () => {
  let db: Database
  let taskRepo: TaskRepository
  let projectRepo: ProjectRepository

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()

    // Create tables
    db.run(`CREATE TABLE tasks (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, description TEXT,
      project_id TEXT, section_id TEXT, parent_id TEXT,
      due_date INTEGER, deadline INTEGER, duration INTEGER,
      recurrence_rule TEXT, priority INTEGER DEFAULT 4,
      completed INTEGER DEFAULT 0, completed_at INTEGER,
      sort_order REAL DEFAULT 0, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, deleted_at INTEGER
    )`)
    db.run(`CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT DEFAULT '#808080',
      parent_id TEXT, sort_order REAL DEFAULT 0, view_mode TEXT DEFAULT 'list',
      is_favorite INTEGER DEFAULT 0, description TEXT, archived_at INTEGER,
      created_at INTEGER NOT NULL, deleted_at INTEGER
    )`)
    db.run(`CREATE TABLE task_labels (
      task_id TEXT NOT NULL, label_id TEXT NOT NULL,
      PRIMARY KEY (task_id, label_id)
    )`)
    db.run(`CREATE TABLE labels (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT DEFAULT '#808080',
      sort_order REAL DEFAULT 0, is_favorite INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )`)
    db.run(`CREATE TABLE karma_stats (
      id TEXT PRIMARY KEY DEFAULT 'default',
      total_points INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0, daily_goal INTEGER DEFAULT 5,
      weekly_goal INTEGER DEFAULT 25
    )`)
    db.run("INSERT INTO karma_stats (id) VALUES ('default')")

    taskRepo = new TaskRepository(db)
    projectRepo = new ProjectRepository(db)
  })

  describe('registerResources', () => {
    it('should return static resources without repos', () => {
      const resources = registerResources()
      expect(resources.length).toBe(5)
      expect(resources.map(r => r.uri)).toEqual([
        'todoer://today',
        'todoer://inbox',
        'todoer://overdue',
        'todoer://upcoming',
        'todoer://stats'
      ])
    })

    it('should include project resources when repos provided', () => {
      projectRepo.create({ name: 'TestProject', color: '#ff0000' })
      projectRepo.create({ name: 'AnotherProject', color: '#00ff00' })

      const resources = registerResources({ projectRepo })
      expect(resources.length).toBe(7) // 5 static + 2 project
      const projectResources = resources.filter(r => r.uri.startsWith('todoer://project/'))
      expect(projectResources).toHaveLength(2)
      expect(projectResources[0].name).toContain('TestProject')
      expect(projectResources[1].name).toContain('AnotherProject')
    })

    it('should use correct URI format for projects', () => {
      const project = projectRepo.create({ name: 'MyProject', color: '#0000ff' })

      const resources = registerResources({ projectRepo })
      const projectResource = resources.find(r => r.uri.includes(project.id))
      expect(projectResource).toBeDefined()
      expect(projectResource!.uri).toBe(`todoer://project/${project.id}`)
      expect(projectResource!.mimeType).toBe('application/json')
    })
  })

  describe('handleResourceRead', () => {
    it('should read project resource with tasks', () => {
      const project = projectRepo.create({ name: 'ReadTest', color: '#ff0000' })
      taskRepo.create({ content: 'Task in project', projectId: project.id })

      const result = handleResourceRead(`todoer://project/${project.id}`, { taskRepo, projectRepo, db })
      const data = JSON.parse(result.contents[0].text)
      expect(data.project.name).toBe('ReadTest')
      expect(data.tasks).toHaveLength(1)
      expect(data.tasks[0].content).toBe('Task in project')
    })

    it('should return error for non-existent project', () => {
      const result = handleResourceRead('todoer://project/nonexistent', { taskRepo, projectRepo, db })
      const data = JSON.parse(result.contents[0].text)
      expect(data.error).toBe('Project not found')
    })

    it('should not rely on a private taskRepo db field for stats resource', () => {
      const lightweightTaskRepo = {
        list: () => [],
        getOverdue: () => [],
        getToday: () => []
      } as unknown as TaskRepository

      expect(() =>
        handleResourceRead('todoer://stats', { taskRepo: lightweightTaskRepo, projectRepo, db })
      ).not.toThrow()
    })
  })
})
