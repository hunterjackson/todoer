import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDatabase } from '@main/db'
import { TaskRepository } from '@main/db/repositories/taskRepository'
import { ProjectRepository } from '@main/db/repositories/projectRepository'
import { LabelRepository } from '@main/db/repositories/labelRepository'
import { FilterRepository } from '@main/db/repositories/filterRepository'
import { evaluateFilter, createFilterContext } from '@main/services/filterEngine'
import { Database as SqlJsDatabase } from 'sql.js'
import { startOfDay, addDays } from '@shared/utils'

describe('Filter Engine Integration Tests', () => {
  let db: SqlJsDatabase
  let taskRepo: TaskRepository
  let projectRepo: ProjectRepository
  let labelRepo: LabelRepository
  let filterRepo: FilterRepository

  beforeEach(async () => {
    db = await createTestDatabase()
    taskRepo = new TaskRepository(db)
    projectRepo = new ProjectRepository(db)
    labelRepo = new LabelRepository(db)
    filterRepo = new FilterRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('Filter Evaluation with Real Data', () => {
    it('should filter tasks by today due date', () => {
      const todayStart = startOfDay()
      const tomorrow = startOfDay(addDays(Date.now(), 1))
      const yesterday = startOfDay(addDays(Date.now(), -1))

      taskRepo.create({ content: 'Task due today', dueDate: todayStart + 1000 })
      taskRepo.create({ content: 'Task due tomorrow', dueDate: tomorrow })
      taskRepo.create({ content: 'Overdue task', dueDate: yesterday })
      taskRepo.create({ content: 'No date task' })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const todayTasks = evaluateFilter(allTasks, 'today', context)
      expect(todayTasks).toHaveLength(1)
      expect(todayTasks[0].content).toBe('Task due today')
    })

    it('should filter tasks by priority', () => {
      taskRepo.create({ content: 'P1 task', priority: 1 })
      taskRepo.create({ content: 'P2 task', priority: 2 })
      taskRepo.create({ content: 'P3 task', priority: 3 })
      taskRepo.create({ content: 'P4 task', priority: 4 })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const p1Tasks = evaluateFilter(allTasks, 'p1', context)
      expect(p1Tasks).toHaveLength(1)
      expect(p1Tasks[0].content).toBe('P1 task')

      const p2Tasks = evaluateFilter(allTasks, 'p2', context)
      expect(p2Tasks).toHaveLength(1)
      expect(p2Tasks[0].content).toBe('P2 task')
    })

    it('should filter tasks by project using #name syntax', () => {
      const workProject = projectRepo.create({ name: 'Work' })
      const personalProject = projectRepo.create({ name: 'Personal' })

      taskRepo.create({ content: 'Work task 1', projectId: workProject.id })
      taskRepo.create({ content: 'Work task 2', projectId: workProject.id })
      taskRepo.create({ content: 'Personal task', projectId: personalProject.id })

      const allTasks = taskRepo.list({ completed: false })
      const projects = projectRepo.list()
      const context = createFilterContext(projects, [])

      const workTasks = evaluateFilter(allTasks, '#work', context)
      expect(workTasks).toHaveLength(2)
      expect(workTasks.every(t => t.projectId === workProject.id)).toBe(true)
    })

    it('should filter overdue tasks', () => {
      const yesterday = startOfDay(addDays(Date.now(), -1))
      const lastWeek = startOfDay(addDays(Date.now(), -7))
      const tomorrow = startOfDay(addDays(Date.now(), 1))

      taskRepo.create({ content: 'Overdue yesterday', dueDate: yesterday })
      taskRepo.create({ content: 'Overdue last week', dueDate: lastWeek })
      taskRepo.create({ content: 'Due tomorrow', dueDate: tomorrow })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const overdueTasks = evaluateFilter(allTasks, 'overdue', context)
      expect(overdueTasks).toHaveLength(2)
    })

    it('should filter tasks with no due date', () => {
      taskRepo.create({ content: 'Has date', dueDate: Date.now() })
      taskRepo.create({ content: 'No date 1' })
      taskRepo.create({ content: 'No date 2' })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const noDateTasks = evaluateFilter(allTasks, 'no date', context)
      expect(noDateTasks).toHaveLength(2)
    })

    it('should handle AND operator (&)', () => {
      const todayStart = startOfDay()

      taskRepo.create({ content: 'P1 today', priority: 1, dueDate: todayStart + 1000 })
      taskRepo.create({ content: 'P1 no date', priority: 1 })
      taskRepo.create({ content: 'P4 today', priority: 4, dueDate: todayStart + 1000 })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const p1AndToday = evaluateFilter(allTasks, 'p1 & today', context)
      expect(p1AndToday).toHaveLength(1)
      expect(p1AndToday[0].content).toBe('P1 today')
    })

    it('should handle OR operator (|)', () => {
      taskRepo.create({ content: 'P1 task', priority: 1 })
      taskRepo.create({ content: 'P2 task', priority: 2 })
      taskRepo.create({ content: 'P3 task', priority: 3 })
      taskRepo.create({ content: 'P4 task', priority: 4 })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const p1OrP2 = evaluateFilter(allTasks, 'p1 | p2', context)
      expect(p1OrP2).toHaveLength(2)
    })

    it('should handle complex queries with AND and OR', () => {
      const todayStart = startOfDay()
      const yesterday = startOfDay(addDays(Date.now(), -1))

      taskRepo.create({ content: 'P1 today', priority: 1, dueDate: todayStart + 1000 })
      taskRepo.create({ content: 'P2 today', priority: 2, dueDate: todayStart + 1000 })
      taskRepo.create({ content: 'Overdue task', priority: 4, dueDate: yesterday })
      taskRepo.create({ content: 'P4 no date', priority: 4 })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      // (today AND p1) OR overdue
      const result = evaluateFilter(allTasks, 'today & p1 | overdue', context)
      expect(result).toHaveLength(2) // P1 today + overdue task
    })

    it('should filter by "next N days"', () => {
      const in3Days = addDays(Date.now(), 3)
      const in10Days = addDays(Date.now(), 10)

      taskRepo.create({ content: 'In 3 days', dueDate: in3Days })
      taskRepo.create({ content: 'In 10 days', dueDate: in10Days })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const next7 = evaluateFilter(allTasks, '7 days', context)
      expect(next7).toHaveLength(1)
      expect(next7[0].content).toBe('In 3 days')
    })
  })

  describe('Filter Repository CRUD', () => {
    it('should create and retrieve a filter', () => {
      const filter = filterRepo.create({
        name: 'High Priority Today',
        query: 'today & p1',
        color: '#ff0000'
      })

      expect(filter.name).toBe('High Priority Today')
      expect(filter.query).toBe('today & p1')
      expect(filter.color).toBe('#ff0000')

      const retrieved = filterRepo.get(filter.id)
      expect(retrieved).toEqual(filter)
    })

    it('should update a filter', () => {
      const filter = filterRepo.create({
        name: 'Test Filter',
        query: 'today'
      })

      const updated = filterRepo.update(filter.id, {
        name: 'Updated Filter',
        query: 'today | tomorrow'
      })

      expect(updated?.name).toBe('Updated Filter')
      expect(updated?.query).toBe('today | tomorrow')
    })

    it('should delete a filter', () => {
      const filter = filterRepo.create({
        name: 'To Delete',
        query: 'p1'
      })

      const deleted = filterRepo.delete(filter.id)
      expect(deleted).toBe(true)

      const retrieved = filterRepo.get(filter.id)
      expect(retrieved).toBeNull()
    })

    it('should list all filters in sort order', () => {
      filterRepo.create({ name: 'Filter A', query: 'p1' })
      filterRepo.create({ name: 'Filter B', query: 'p2' })
      filterRepo.create({ name: 'Filter C', query: 'p3' })

      const filters = filterRepo.list()
      expect(filters).toHaveLength(3)
      expect(filters[0].sortOrder).toBeLessThan(filters[1].sortOrder)
      expect(filters[1].sortOrder).toBeLessThan(filters[2].sortOrder)
    })
  })

  describe('Bug Regression Tests', () => {
    it('should show newly created projects in task assignment', () => {
      // Bug: After creating a project, it should be available for task assignment
      const project = projectRepo.create({ name: 'New Project' })

      // Verify project exists
      const projects = projectRepo.list()
      expect(projects.some(p => p.id === project.id)).toBe(true)

      // Create task and assign to new project
      const task = taskRepo.create({
        content: 'Task in new project',
        projectId: project.id
      })

      expect(task.projectId).toBe(project.id)

      // Verify task is retrievable by project
      const projectTasks = taskRepo.list({ projectId: project.id })
      expect(projectTasks).toHaveLength(1)
      expect(projectTasks[0].id).toBe(task.id)
    })

    it('should filter tasks by label correctly', () => {
      // Bug: LabelView was not filtering tasks by label
      const label = labelRepo.create({ name: 'urgent', color: '#ff0000' })

      taskRepo.create({ content: 'Urgent task', labelIds: [label.id] })
      taskRepo.create({ content: 'Normal task' })

      // Get tasks with this label
      const labelTasks = taskRepo.list({ labelId: label.id })
      expect(labelTasks).toHaveLength(1)
      expect(labelTasks[0].content).toBe('Urgent task')
    })

    it('should preserve labels when updating task project', () => {
      // Bug: Labels should not be lost when moving task to different project
      const project1 = projectRepo.create({ name: 'Project 1' })
      const project2 = projectRepo.create({ name: 'Project 2' })
      const label = labelRepo.create({ name: 'important' })

      const task = taskRepo.create({
        content: 'Task with label',
        projectId: project1.id,
        labelIds: [label.id]
      })

      // Move to different project
      taskRepo.update(task.id, { projectId: project2.id })

      // Labels should still be attached
      const labels = taskRepo.getLabels(task.id)
      expect(labels).toHaveLength(1)
      expect(labels[0].id).toBe(label.id)
    })

    it('should not include completed tasks in filter results', () => {
      taskRepo.create({ content: 'Active task', priority: 1 })
      const completedTask = taskRepo.create({ content: 'Completed task', priority: 1 })
      taskRepo.complete(completedTask.id)

      const allTasks = taskRepo.list({}) // Get all including completed
      const context = createFilterContext([], [])

      const filtered = evaluateFilter(allTasks, 'p1', context)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].content).toBe('Active task')
    })

    it('should not include deleted tasks in filter results', () => {
      taskRepo.create({ content: 'Active task', priority: 1 })
      const deletedTask = taskRepo.create({ content: 'Deleted task', priority: 1 })
      taskRepo.delete(deletedTask.id)

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const filtered = evaluateFilter(allTasks, 'p1', context)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].content).toBe('Active task')
    })

    it('should handle empty filter query', () => {
      taskRepo.create({ content: 'Task 1' })
      taskRepo.create({ content: 'Task 2' })

      const allTasks = taskRepo.list({ completed: false })
      const context = createFilterContext([], [])

      const filtered = evaluateFilter(allTasks, '', context)
      expect(filtered).toHaveLength(2)
    })
  })
})
