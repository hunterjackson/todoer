import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'
import { ReminderRepository } from '../../../src/main/db/repositories/reminderRepository'
import { TaskRepository } from '../../../src/main/db/repositories/taskRepository'
import type { Task } from '../../../src/shared/types'

describe('ReminderRepository', () => {
  let db: Database
  let reminderRepo: ReminderRepository
  let taskRepo: TaskRepository
  let testTask: Task

  const createDb = async () => {
    const SQL = await initSqlJs()
    return new SQL.Database()
  }

  beforeEach(async () => {
    db = await createDb()

    // Create tables
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
        deleted_at INTEGER,
        delegated_to TEXT
      )
    `)

    db.run(`
      CREATE TABLE reminders (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remind_at INTEGER NOT NULL,
        notified INTEGER DEFAULT 0,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    taskRepo = new TaskRepository(db)
    reminderRepo = new ReminderRepository(db)

    // Create a test task
    testTask = taskRepo.create({ content: 'Test task' })
  })

  describe('create', () => {
    it('should create a reminder', () => {
      const remindAt = Date.now() + 60000
      const reminder = reminderRepo.create({
        taskId: testTask.id,
        remindAt
      })

      expect(reminder.id).toBeDefined()
      expect(reminder.taskId).toBe(testTask.id)
      expect(reminder.remindAt).toBe(remindAt)
      expect(reminder.notified).toBe(false)
    })

    it('should generate unique IDs', () => {
      const reminder1 = reminderRepo.create({
        taskId: testTask.id,
        remindAt: Date.now() + 60000
      })
      const reminder2 = reminderRepo.create({
        taskId: testTask.id,
        remindAt: Date.now() + 120000
      })

      expect(reminder1.id).not.toBe(reminder2.id)
    })
  })

  describe('get', () => {
    it('should get a reminder by ID', () => {
      const remindAt = Date.now() + 60000
      const created = reminderRepo.create({
        taskId: testTask.id,
        remindAt
      })

      const retrieved = reminderRepo.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.taskId).toBe(testTask.id)
      expect(retrieved?.remindAt).toBe(remindAt)
    })

    it('should return null for non-existent reminder', () => {
      const result = reminderRepo.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('getByTask', () => {
    it('should get all reminders for a task', () => {
      const reminder1 = reminderRepo.create({
        taskId: testTask.id,
        remindAt: Date.now() + 60000
      })
      const reminder2 = reminderRepo.create({
        taskId: testTask.id,
        remindAt: Date.now() + 120000
      })

      const reminders = reminderRepo.getByTask(testTask.id)

      expect(reminders).toHaveLength(2)
      expect(reminders[0].id).toBe(reminder1.id)
      expect(reminders[1].id).toBe(reminder2.id)
    })

    it('should return empty array for task with no reminders', () => {
      const reminders = reminderRepo.getByTask(testTask.id)
      expect(reminders).toHaveLength(0)
    })

    it('should order reminders by remind_at ascending', () => {
      const later = Date.now() + 120000
      const earlier = Date.now() + 60000

      reminderRepo.create({ taskId: testTask.id, remindAt: later })
      reminderRepo.create({ taskId: testTask.id, remindAt: earlier })

      const reminders = reminderRepo.getByTask(testTask.id)

      expect(reminders[0].remindAt).toBe(earlier)
      expect(reminders[1].remindAt).toBe(later)
    })
  })

  describe('getDue', () => {
    it('should get reminders that are due now', () => {
      const past = Date.now() - 60000
      const future = Date.now() + 60000

      reminderRepo.create({ taskId: testTask.id, remindAt: past })
      reminderRepo.create({ taskId: testTask.id, remindAt: future })

      const due = reminderRepo.getDue()

      expect(due).toHaveLength(1)
      expect(due[0].remindAt).toBe(past)
    })

    it('should not include notified reminders', () => {
      const past = Date.now() - 60000
      const reminder = reminderRepo.create({ taskId: testTask.id, remindAt: past })

      reminderRepo.markNotified(reminder.id)

      const due = reminderRepo.getDue()
      expect(due).toHaveLength(0)
    })

    it('should order by remind_at ascending', () => {
      const earlier = Date.now() - 120000
      const later = Date.now() - 60000

      reminderRepo.create({ taskId: testTask.id, remindAt: later })
      reminderRepo.create({ taskId: testTask.id, remindAt: earlier })

      const due = reminderRepo.getDue()

      expect(due[0].remindAt).toBe(earlier)
      expect(due[1].remindAt).toBe(later)
    })
  })

  describe('getUpcoming', () => {
    it('should get reminders within the specified time window', () => {
      const now = Date.now()
      const inHalfHour = now + 1800000 // 30 minutes from now
      const inTwoHours = now + 7200000 // 2 hours from now

      reminderRepo.create({ taskId: testTask.id, remindAt: inHalfHour })
      reminderRepo.create({ taskId: testTask.id, remindAt: inTwoHours })

      // Default is 1 hour window
      const upcoming = reminderRepo.getUpcoming()

      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].remindAt).toBe(inHalfHour)
    })

    it('should accept custom time window', () => {
      const now = Date.now()
      const inHalfHour = now + 1800000
      const inTwoHours = now + 7200000

      reminderRepo.create({ taskId: testTask.id, remindAt: inHalfHour })
      reminderRepo.create({ taskId: testTask.id, remindAt: inTwoHours })

      // Use 3 hour window
      const upcoming = reminderRepo.getUpcoming(3 * 3600000)

      expect(upcoming).toHaveLength(2)
    })

    it('should not include already due reminders', () => {
      const past = Date.now() - 60000
      const future = Date.now() + 1800000

      reminderRepo.create({ taskId: testTask.id, remindAt: past })
      reminderRepo.create({ taskId: testTask.id, remindAt: future })

      const upcoming = reminderRepo.getUpcoming()

      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].remindAt).toBe(future)
    })

    it('should not include notified reminders', () => {
      const future = Date.now() + 1800000
      const reminder = reminderRepo.create({ taskId: testTask.id, remindAt: future })

      reminderRepo.markNotified(reminder.id)

      const upcoming = reminderRepo.getUpcoming()
      expect(upcoming).toHaveLength(0)
    })
  })

  describe('markNotified', () => {
    it('should mark a reminder as notified', () => {
      const reminder = reminderRepo.create({
        taskId: testTask.id,
        remindAt: Date.now() + 60000
      })

      expect(reminderRepo.get(reminder.id)?.notified).toBe(false)

      reminderRepo.markNotified(reminder.id)

      expect(reminderRepo.get(reminder.id)?.notified).toBe(true)
    })
  })

  describe('delete', () => {
    it('should delete a reminder', () => {
      const reminder = reminderRepo.create({
        taskId: testTask.id,
        remindAt: Date.now() + 60000
      })

      expect(reminderRepo.get(reminder.id)).toBeDefined()

      reminderRepo.delete(reminder.id)

      expect(reminderRepo.get(reminder.id)).toBeNull()
    })
  })

  describe('deleteByTask', () => {
    it('should delete all reminders for a task', () => {
      reminderRepo.create({ taskId: testTask.id, remindAt: Date.now() + 60000 })
      reminderRepo.create({ taskId: testTask.id, remindAt: Date.now() + 120000 })

      expect(reminderRepo.getByTask(testTask.id)).toHaveLength(2)

      reminderRepo.deleteByTask(testTask.id)

      expect(reminderRepo.getByTask(testTask.id)).toHaveLength(0)
    })

    it('should not affect reminders for other tasks', () => {
      const task2 = taskRepo.create({ content: 'Another task' })

      reminderRepo.create({ taskId: testTask.id, remindAt: Date.now() + 60000 })
      reminderRepo.create({ taskId: task2.id, remindAt: Date.now() + 60000 })

      reminderRepo.deleteByTask(testTask.id)

      expect(reminderRepo.getByTask(testTask.id)).toHaveLength(0)
      expect(reminderRepo.getByTask(task2.id)).toHaveLength(1)
    })
  })
})
