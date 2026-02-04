import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'
import { SectionRepository } from '../../../src/main/db/repositories/sectionRepository'
import { ProjectRepository } from '../../../src/main/db/repositories/projectRepository'
import { TaskRepository } from '../../../src/main/db/repositories/taskRepository'
import type { Project } from '../../../src/shared/types'

describe('SectionRepository', () => {
  let db: Database
  let sectionRepo: SectionRepository
  let projectRepo: ProjectRepository
  let taskRepo: TaskRepository
  let testProject: Project

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
        color TEXT DEFAULT 'gray',
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
      CREATE TABLE sections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_id TEXT NOT NULL,
        sort_order REAL DEFAULT 0,
        is_collapsed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
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

    projectRepo = new ProjectRepository(db)
    sectionRepo = new SectionRepository(db)
    taskRepo = new TaskRepository(db)

    // Create a test project
    testProject = projectRepo.create({ name: 'Test Project' })
  })

  describe('create', () => {
    it('should create a section', () => {
      const section = sectionRepo.create({
        name: 'My Section',
        projectId: testProject.id
      })

      expect(section.id).toBeDefined()
      expect(section.name).toBe('My Section')
      expect(section.projectId).toBe(testProject.id)
      expect(section.isCollapsed).toBe(false)
    })

    it('should auto-assign sort order', () => {
      const section1 = sectionRepo.create({
        name: 'Section 1',
        projectId: testProject.id
      })
      const section2 = sectionRepo.create({
        name: 'Section 2',
        projectId: testProject.id
      })

      expect(section2.sortOrder).toBeGreaterThan(section1.sortOrder)
    })
  })

  describe('get', () => {
    it('should get a section by ID', () => {
      const created = sectionRepo.create({
        name: 'My Section',
        projectId: testProject.id
      })

      const retrieved = sectionRepo.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe('My Section')
    })

    it('should return null for non-existent section', () => {
      const result = sectionRepo.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('should list sections for a project', () => {
      sectionRepo.create({ name: 'Section 1', projectId: testProject.id })
      sectionRepo.create({ name: 'Section 2', projectId: testProject.id })

      const sections = sectionRepo.list(testProject.id)

      expect(sections).toHaveLength(2)
      expect(sections[0].name).toBe('Section 1')
      expect(sections[1].name).toBe('Section 2')
    })

    it('should return empty array for project with no sections', () => {
      const sections = sectionRepo.list(testProject.id)
      expect(sections).toHaveLength(0)
    })

    it('should order sections by sort_order', () => {
      const s1 = sectionRepo.create({ name: 'First', projectId: testProject.id })
      const s2 = sectionRepo.create({ name: 'Second', projectId: testProject.id })

      // Manually set sort orders
      sectionRepo.reorder(s2.id, 0.5)
      sectionRepo.reorder(s1.id, 1)

      const sections = sectionRepo.list(testProject.id)
      expect(sections[0].name).toBe('Second')
      expect(sections[1].name).toBe('First')
    })
  })

  describe('update', () => {
    it('should update section name', () => {
      const section = sectionRepo.create({
        name: 'Old Name',
        projectId: testProject.id
      })

      const updated = sectionRepo.update(section.id, { name: 'New Name' })

      expect(updated?.name).toBe('New Name')
    })

    it('should update isCollapsed', () => {
      const section = sectionRepo.create({
        name: 'My Section',
        projectId: testProject.id
      })

      expect(section.isCollapsed).toBe(false)

      const updated = sectionRepo.update(section.id, { isCollapsed: true })

      expect(updated?.isCollapsed).toBe(true)
    })

    it('should return null for non-existent section', () => {
      const result = sectionRepo.update('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should handle update with no changes', () => {
      const section = sectionRepo.create({
        name: 'My Section',
        projectId: testProject.id
      })

      const updated = sectionRepo.update(section.id, {})

      expect(updated?.name).toBe('My Section')
    })
  })

  describe('delete', () => {
    it('should delete a section', () => {
      const section = sectionRepo.create({
        name: 'My Section',
        projectId: testProject.id
      })

      const result = sectionRepo.delete(section.id)

      expect(result).toBe(true)
      expect(sectionRepo.get(section.id)).toBeNull()
    })

    it('should return false for non-existent section', () => {
      const result = sectionRepo.delete('non-existent')
      expect(result).toBe(false)
    })

    it('should clear section_id from tasks in deleted section', () => {
      const section = sectionRepo.create({
        name: 'My Section',
        projectId: testProject.id
      })

      const task = taskRepo.create({
        content: 'Task in section',
        projectId: testProject.id,
        sectionId: section.id
      })

      expect(taskRepo.get(task.id)?.sectionId).toBe(section.id)

      sectionRepo.delete(section.id)

      expect(taskRepo.get(task.id)?.sectionId).toBeNull()
    })
  })

  describe('reorder', () => {
    it('should update sort order', () => {
      const section = sectionRepo.create({
        name: 'My Section',
        projectId: testProject.id
      })

      const updated = sectionRepo.reorder(section.id, 5.5)

      expect(updated?.sortOrder).toBe(5.5)
    })

    it('should return null for non-existent section', () => {
      const result = sectionRepo.reorder('non-existent', 5)
      expect(result).toBeNull()
    })
  })
})
