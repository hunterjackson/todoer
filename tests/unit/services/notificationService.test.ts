import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron before importing the real service
vi.mock('electron', () => ({
  Notification: class MockNotification {
    static isSupported() { return true }
    constructor(_opts: any) {}
    show() {}
  },
  app: {
    getPath: () => '/tmp',
    getName: () => 'todoer-test'
  }
}))

import { NotificationService } from '@main/services/notificationService'
import type { Task, Reminder } from '@shared/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    content: 'Test task',
    description: null,
    projectId: null,
    sectionId: null,
    parentId: null,
    dueDate: null,
    deadline: null,
    duration: null,
    recurrenceRule: null,
    priority: 4,
    completed: false,
    completedAt: null,
    sortOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    labels: [],
    ...overrides
  }
}

describe('Notification Service (real)', () => {
  let service: NotificationService

  beforeEach(() => {
    service = new NotificationService()
  })

  describe('Reminder scheduling', () => {
    it('should calculate time until reminder', () => {
      const now = Date.now()
      const remindAt = now + 60000

      const timeUntil = service.getTimeUntilReminder(remindAt)

      expect(timeUntil).toBeGreaterThan(59000)
      expect(timeUntil).toBeLessThanOrEqual(60000)
    })

    it('should return 0 for past reminders', () => {
      const past = Date.now() - 60000

      const timeUntil = service.getTimeUntilReminder(past)

      expect(timeUntil).toBe(0)
    })

    it('should identify due reminders', () => {
      const pastReminder: Reminder = { id: '1', taskId: 't1', remindAt: Date.now() - 1000, notified: false }
      const futureReminder: Reminder = { id: '2', taskId: 't2', remindAt: Date.now() + 60000, notified: false }
      const notifiedReminder: Reminder = { id: '3', taskId: 't3', remindAt: Date.now() - 1000, notified: true }

      const due = service.getDueReminders([pastReminder, futureReminder, notifiedReminder])

      expect(due).toHaveLength(1)
      expect(due[0].id).toBe('1')
    })
  })

  describe('Notification content', () => {
    it('should format notification for task', () => {
      const task = makeTask({ content: 'Meeting with team', priority: 1, dueDate: Date.now() })

      const notification = service.formatTaskNotification(task)

      expect(notification.title).toBe('Task Reminder')
      expect(notification.body).toContain('Meeting with team')
    })

    it('should include priority in urgent tasks', () => {
      const task = makeTask({ content: 'Urgent task', priority: 1 })

      const notification = service.formatTaskNotification(task)

      expect(notification.body).toContain('Priority 1')
    })

    it('should not include priority for low priority tasks', () => {
      const task = makeTask({ content: 'Normal task', priority: 3 })

      const notification = service.formatTaskNotification(task)

      expect(notification.body).not.toContain('Priority')
    })

    it('should format overdue notification differently', () => {
      const task = makeTask({ content: 'Overdue task', dueDate: Date.now() - 86400000, priority: 2 })

      const notification = service.formatOverdueNotification(task)

      expect(notification.title).toContain('Overdue')
    })
  })

  describe('Notification preferences', () => {
    it('should respect notification enabled setting', () => {
      service.setEnabled(false)
      expect(service.isEnabled()).toBe(false)

      service.setEnabled(true)
      expect(service.isEnabled()).toBe(true)
    })

    it('should respect quiet hours', () => {
      service.setQuietHours(22, 7)

      const quietTime = new Date()
      quietTime.setHours(23, 0, 0, 0)
      expect(service.isQuietTime(quietTime)).toBe(true)

      const activeTime = new Date()
      activeTime.setHours(12, 0, 0, 0)
      expect(service.isQuietTime(activeTime)).toBe(false)
    })
  })

  describe('showNotification return value', () => {
    it('should return false when disabled', () => {
      service.setEnabled(false)
      const result = service.showNotification({ title: 'Test', body: 'Test' })
      expect(result).toBe(false)
    })

    it('should return false during quiet hours', () => {
      service.setEnabled(true)
      // Use 0-24 range to cover all hours regardless of CI timezone
      service.setQuietHours(0, 24)
      const result = service.showNotification({ title: 'Test', body: 'Test' })
      expect(result).toBe(false)
    })

    it('should return true when enabled and not quiet', () => {
      service.setEnabled(true)
      const now = new Date()
      const safeHour = (now.getHours() + 12) % 24
      service.setQuietHours(safeHour, (safeHour + 1) % 24)
      const result = service.showNotification({ title: 'Test', body: 'Test' })
      expect(result).toBe(true)
    })

    it('showTaskReminder should return false when notification not shown', () => {
      service.setEnabled(false)
      const task = makeTask({ content: 'Task', dueDate: Date.now(), priority: 4 })
      const result = service.showTaskReminder(task)
      expect(result).toBe(false)
    })
  })

  describe('Reminder creation', () => {
    it('should create reminder from due date with offset', () => {
      const dueDate = Date.now() + 3600000
      const offsetMinutes = 30

      const remindAt = service.calculateReminderTime(dueDate, offsetMinutes)

      expect(remindAt).toBe(dueDate - offsetMinutes * 60000)
    })

    it('should not create reminder in the past', () => {
      const dueDate = Date.now() + 60000
      const offsetMinutes = 30

      const remindAt = service.calculateReminderTime(dueDate, offsetMinutes)

      expect(remindAt).toBeGreaterThanOrEqual(Date.now() - 1000)
    })
  })
})
