import { describe, it, expect, beforeEach, vi } from 'vitest'

// Notification Service Tests
describe('Notification Service', () => {
  let notificationService: NotificationService

  beforeEach(() => {
    notificationService = new NotificationService()
  })

  describe('Reminder scheduling', () => {
    it('should calculate time until reminder', () => {
      const now = Date.now()
      const remindAt = now + 60000 // 1 minute from now

      const timeUntil = notificationService.getTimeUntilReminder(remindAt)

      expect(timeUntil).toBeGreaterThan(59000)
      expect(timeUntil).toBeLessThanOrEqual(60000)
    })

    it('should return 0 for past reminders', () => {
      const past = Date.now() - 60000 // 1 minute ago

      const timeUntil = notificationService.getTimeUntilReminder(past)

      expect(timeUntil).toBe(0)
    })

    it('should identify due reminders', () => {
      const pastReminder = { id: '1', taskId: 't1', remindAt: Date.now() - 1000, notified: false }
      const futureReminder = { id: '2', taskId: 't2', remindAt: Date.now() + 60000, notified: false }
      const notifiedReminder = { id: '3', taskId: 't3', remindAt: Date.now() - 1000, notified: true }

      const reminders = [pastReminder, futureReminder, notifiedReminder]
      const due = notificationService.getDueReminders(reminders)

      expect(due).toHaveLength(1)
      expect(due[0].id).toBe('1')
    })
  })

  describe('Notification content', () => {
    it('should format notification for task', () => {
      const task = {
        id: 't1',
        content: 'Meeting with team',
        dueDate: Date.now(),
        priority: 1
      }

      const notification = notificationService.formatTaskNotification(task)

      expect(notification.title).toBe('Task Reminder')
      expect(notification.body).toContain('Meeting with team')
    })

    it('should include priority in urgent tasks', () => {
      const task = {
        id: 't1',
        content: 'Urgent task',
        dueDate: Date.now(),
        priority: 1
      }

      const notification = notificationService.formatTaskNotification(task)

      expect(notification.body).toContain('Priority 1')
    })

    it('should format overdue notification differently', () => {
      const task = {
        id: 't1',
        content: 'Overdue task',
        dueDate: Date.now() - 86400000, // Yesterday
        priority: 2
      }

      const notification = notificationService.formatOverdueNotification(task)

      expect(notification.title).toContain('Overdue')
    })
  })

  describe('Notification preferences', () => {
    it('should respect notification enabled setting', () => {
      notificationService.setEnabled(false)
      expect(notificationService.isEnabled()).toBe(false)

      notificationService.setEnabled(true)
      expect(notificationService.isEnabled()).toBe(true)
    })

    it('should respect quiet hours', () => {
      const quietStart = 22 // 10 PM
      const quietEnd = 7 // 7 AM

      notificationService.setQuietHours(quietStart, quietEnd)

      // Test during quiet hours (11 PM)
      const quietTime = new Date()
      quietTime.setHours(23, 0, 0, 0)
      expect(notificationService.isQuietTime(quietTime)).toBe(true)

      // Test outside quiet hours (12 PM)
      const activeTime = new Date()
      activeTime.setHours(12, 0, 0, 0)
      expect(notificationService.isQuietTime(activeTime)).toBe(false)
    })
  })

  describe('showNotification return value', () => {
    it('should return false when disabled', () => {
      notificationService.setEnabled(false)
      const result = notificationService.showNotification({ title: 'Test', body: 'Test' })
      expect(result).toBe(false)
    })

    it('should return false during quiet hours', () => {
      notificationService.setEnabled(true)
      notificationService.setQuietHours(0, 23) // Almost always quiet
      const result = notificationService.showNotification({ title: 'Test', body: 'Test' })
      expect(result).toBe(false)
    })

    it('should return true when enabled and not quiet', () => {
      notificationService.setEnabled(true)
      // Set quiet hours to a time that won't conflict
      const now = new Date()
      const safeHour = (now.getHours() + 12) % 24
      notificationService.setQuietHours(safeHour, (safeHour + 1) % 24)
      const result = notificationService.showNotification({ title: 'Test', body: 'Test' })
      expect(result).toBe(true)
    })

    it('showTaskReminder should return false when notification not shown', () => {
      notificationService.setEnabled(false)
      const task = { id: 't1', content: 'Task', dueDate: Date.now(), priority: 4 }
      const result = notificationService.showTaskReminder(task)
      expect(result).toBe(false)
    })
  })

  describe('Reminder creation', () => {
    it('should create reminder from due date with offset', () => {
      const dueDate = Date.now() + 3600000 // 1 hour from now
      const offsetMinutes = 30

      const remindAt = notificationService.calculateReminderTime(dueDate, offsetMinutes)

      expect(remindAt).toBe(dueDate - offsetMinutes * 60000)
    })

    it('should not create reminder in the past', () => {
      const dueDate = Date.now() + 60000 // 1 minute from now
      const offsetMinutes = 30 // Would be in the past

      const remindAt = notificationService.calculateReminderTime(dueDate, offsetMinutes)

      // Should set reminder to now or slight future
      expect(remindAt).toBeGreaterThanOrEqual(Date.now() - 1000)
    })
  })
})

// Types
interface Reminder {
  id: string
  taskId: string
  remindAt: number
  notified: boolean
}

interface TaskForNotification {
  id: string
  content: string
  dueDate: number | null
  priority: number
}

interface NotificationContent {
  title: string
  body: string
  icon?: string
}

// Implementation
class NotificationService {
  private enabled: boolean = true
  private quietHoursStart: number = 22 // 10 PM
  private quietHoursEnd: number = 7 // 7 AM

  getTimeUntilReminder(remindAt: number): number {
    const diff = remindAt - Date.now()
    return diff > 0 ? diff : 0
  }

  getDueReminders(reminders: Reminder[]): Reminder[] {
    const now = Date.now()
    return reminders.filter((r) => !r.notified && r.remindAt <= now)
  }

  formatTaskNotification(task: TaskForNotification): NotificationContent {
    const priorityLabel = task.priority <= 2 ? ` (Priority ${task.priority})` : ''
    return {
      title: 'Task Reminder',
      body: `${task.content}${priorityLabel}`
    }
  }

  formatOverdueNotification(task: TaskForNotification): NotificationContent {
    return {
      title: 'Overdue Task',
      body: task.content
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setQuietHours(start: number, end: number): void {
    this.quietHoursStart = start
    this.quietHoursEnd = end
  }

  isQuietTime(date: Date = new Date()): boolean {
    const hour = date.getHours()
    if (this.quietHoursStart > this.quietHoursEnd) {
      // Quiet hours cross midnight (e.g., 22-7)
      return hour >= this.quietHoursStart || hour < this.quietHoursEnd
    }
    return hour >= this.quietHoursStart && hour < this.quietHoursEnd
  }

  showNotification(content: NotificationContent): boolean {
    if (!this.enabled) return false
    if (this.isQuietTime()) return false
    return true
  }

  showTaskReminder(task: TaskForNotification): boolean {
    const content = this.formatTaskNotification(task)
    return this.showNotification(content)
  }

  calculateReminderTime(dueDate: number, offsetMinutes: number): number {
    const reminderTime = dueDate - offsetMinutes * 60000
    const now = Date.now()
    return reminderTime > now ? reminderTime : now
  }
}
