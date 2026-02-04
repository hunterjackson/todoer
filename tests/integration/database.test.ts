import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDatabase } from '@main/db'
import { TaskRepository } from '@main/db/repositories/taskRepository'
import { ProjectRepository } from '@main/db/repositories/projectRepository'
import { LabelRepository } from '@main/db/repositories/labelRepository'
import { SectionRepository } from '@main/db/repositories/sectionRepository'
import { Database as SqlJsDatabase } from 'sql.js'

describe('Database Integration Tests', () => {
  let db: SqlJsDatabase
  let taskRepo: TaskRepository
  let projectRepo: ProjectRepository
  let labelRepo: LabelRepository
  let sectionRepo: SectionRepository

  beforeEach(async () => {
    db = await createTestDatabase()
    taskRepo = new TaskRepository(db)
    projectRepo = new ProjectRepository(db)
    labelRepo = new LabelRepository(db)
    sectionRepo = new SectionRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('Task and Project Integration', () => {
    it('should create tasks in a project', async () => {
      // Create a project
      const project = projectRepo.create({ name: 'Work' })

      // Create tasks in the project
      const task1 = taskRepo.create({ content: 'Task 1', projectId: project.id })
      const task2 = taskRepo.create({ content: 'Task 2', projectId: project.id })

      // Verify tasks are in the project
      const projectTasks = taskRepo.list({ projectId: project.id })
      expect(projectTasks).toHaveLength(2)
      expect(projectTasks[0].projectId).toBe(project.id)
      expect(projectTasks[1].projectId).toBe(project.id)
    })

    it('should get task count for project', async () => {
      const project = projectRepo.create({ name: 'Test Project' })

      taskRepo.create({ content: 'Task 1', projectId: project.id })
      taskRepo.create({ content: 'Task 2', projectId: project.id })
      taskRepo.create({ content: 'Task 3', projectId: project.id })

      const count = projectRepo.getTaskCount(project.id)
      expect(count).toBe(3)
    })
  })

  describe('Task and Label Integration', () => {
    it('should create task with labels', async () => {
      // Create labels
      const label1 = labelRepo.create({ name: 'urgent' })
      const label2 = labelRepo.create({ name: 'work' })

      // Create task with labels
      const task = taskRepo.create({
        content: 'Important task',
        labelIds: [label1.id, label2.id]
      })

      // Verify labels are attached
      const labels = taskRepo.getLabels(task.id)
      expect(labels).toHaveLength(2)
      expect(labels.map((l) => l.name)).toContain('urgent')
      expect(labels.map((l) => l.name)).toContain('work')
    })

    it('should update task labels', async () => {
      const label1 = labelRepo.create({ name: 'label1' })
      const label2 = labelRepo.create({ name: 'label2' })
      const label3 = labelRepo.create({ name: 'label3' })

      // Create task with initial labels
      const task = taskRepo.create({
        content: 'Test task',
        labelIds: [label1.id, label2.id]
      })

      // Update to different labels
      taskRepo.update(task.id, {
        labelIds: [label2.id, label3.id]
      })

      const labels = taskRepo.getLabels(task.id)
      expect(labels).toHaveLength(2)
      expect(labels.map((l) => l.name)).toContain('label2')
      expect(labels.map((l) => l.name)).toContain('label3')
      expect(labels.map((l) => l.name)).not.toContain('label1')
    })
  })

  describe('Task and Section Integration', () => {
    it('should create tasks in sections', async () => {
      const project = projectRepo.create({ name: 'Project' })
      const section = sectionRepo.create({ name: 'In Progress', projectId: project.id })

      const task = taskRepo.create({
        content: 'Task in section',
        projectId: project.id,
        sectionId: section.id
      })

      expect(task.sectionId).toBe(section.id)

      const sectionTasks = taskRepo.list({ sectionId: section.id })
      expect(sectionTasks).toHaveLength(1)
    })

    it('should list sections for a project', async () => {
      const project = projectRepo.create({ name: 'Project' })

      sectionRepo.create({ name: 'Todo', projectId: project.id })
      sectionRepo.create({ name: 'In Progress', projectId: project.id })
      sectionRepo.create({ name: 'Done', projectId: project.id })

      const sections = sectionRepo.list(project.id)
      expect(sections).toHaveLength(3)
    })
  })

  describe('Subtasks Integration', () => {
    it('should create subtasks', async () => {
      const parentTask = taskRepo.create({ content: 'Parent task' })

      const subtask1 = taskRepo.create({
        content: 'Subtask 1',
        parentId: parentTask.id
      })
      const subtask2 = taskRepo.create({
        content: 'Subtask 2',
        parentId: parentTask.id
      })

      const subtasks = taskRepo.getSubtasks(parentTask.id)
      expect(subtasks).toHaveLength(2)
      expect(subtasks[0].parentId).toBe(parentTask.id)
    })

    it('should delete subtasks when parent is deleted', async () => {
      const parentTask = taskRepo.create({ content: 'Parent' })
      const subtask = taskRepo.create({
        content: 'Child',
        parentId: parentTask.id
      })

      taskRepo.delete(parentTask.id)

      // Parent should be soft deleted
      const deletedParent = taskRepo.get(parentTask.id)
      expect(deletedParent).toBeNull()

      // Subtask should also be soft deleted
      const deletedSubtask = taskRepo.get(subtask.id)
      expect(deletedSubtask).toBeNull()
    })
  })

  describe('Task Completion Flow', () => {
    it('should complete and uncomplete tasks', async () => {
      const task = taskRepo.create({ content: 'Test task' })

      expect(task.completed).toBe(false)
      expect(task.completedAt).toBeNull()

      // Complete the task
      const completedTask = taskRepo.complete(task.id)
      expect(completedTask?.completed).toBe(true)
      expect(completedTask?.completedAt).not.toBeNull()

      // Uncomplete the task
      const uncompletedTask = taskRepo.uncomplete(task.id)
      expect(uncompletedTask?.completed).toBe(false)
      expect(uncompletedTask?.completedAt).toBeNull()
    })
  })

  describe('Search Integration', () => {
    it('should search across tasks', async () => {
      taskRepo.create({ content: 'Buy groceries' })
      taskRepo.create({ content: 'Call mom' })
      taskRepo.create({ content: 'Buy new phone' })
      taskRepo.create({ content: 'Write documentation' })

      const buyResults = taskRepo.search('buy')
      expect(buyResults).toHaveLength(2)

      const callResults = taskRepo.search('call')
      expect(callResults).toHaveLength(1)

      const noResults = taskRepo.search('xyz123')
      expect(noResults).toHaveLength(0)
    })
  })

  describe('Date-based Queries', () => {
    it('should get overdue tasks', async () => {
      const yesterday = Date.now() - 86400000
      const tomorrow = Date.now() + 86400000

      taskRepo.create({ content: 'Overdue task', dueDate: yesterday })
      taskRepo.create({ content: 'Future task', dueDate: tomorrow })
      taskRepo.create({ content: 'No date task' })

      const overdue = taskRepo.getOverdue()
      expect(overdue).toHaveLength(1)
      expect(overdue[0].content).toBe('Overdue task')
    })

    it('should get upcoming tasks', async () => {
      const tomorrow = Date.now() + 86400000
      const nextWeek = Date.now() + 5 * 86400000
      const farFuture = Date.now() + 30 * 86400000

      taskRepo.create({ content: 'Tomorrow task', dueDate: tomorrow })
      taskRepo.create({ content: 'Next week task', dueDate: nextWeek })
      taskRepo.create({ content: 'Far future task', dueDate: farFuture })

      const upcoming = taskRepo.getUpcoming(7)
      expect(upcoming.length).toBeGreaterThanOrEqual(2)
      expect(upcoming.length).toBeLessThanOrEqual(3)
    })
  })
})
