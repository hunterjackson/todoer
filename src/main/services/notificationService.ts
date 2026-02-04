import { Notification, app } from 'electron'
import type { Task, Reminder } from '@shared/types'

interface NotificationContent {
  title: string
  body: string
  icon?: string
}

export class NotificationService {
  private enabled: boolean = true
  private quietHoursStart: number = 22 // 10 PM
  private quietHoursEnd: number = 7 // 7 AM
  private checkInterval: NodeJS.Timeout | null = null
  private onReminderDue: ((reminder: Reminder, task: Task) => void) | null = null

  /**
   * Initialize the notification service
   */
  initialize(onReminderDue?: (reminder: Reminder, task: Task) => void): void {
    this.onReminderDue = onReminderDue || null
  }

  /**
   * Start checking for due reminders
   */
  startChecking(checkFn: () => Promise<void>, intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    // Initial check
    checkFn()

    // Periodic check
    this.checkInterval = setInterval(checkFn, intervalMs)
  }

  /**
   * Stop checking for reminders
   */
  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * Calculate time until a reminder is due
   */
  getTimeUntilReminder(remindAt: number): number {
    const diff = remindAt - Date.now()
    return diff > 0 ? diff : 0
  }

  /**
   * Get reminders that are due now
   */
  getDueReminders(reminders: Reminder[]): Reminder[] {
    const now = Date.now()
    return reminders.filter((r) => !r.notified && r.remindAt <= now)
  }

  /**
   * Format notification content for a task reminder
   */
  formatTaskNotification(task: Task): NotificationContent {
    const priorityLabel = task.priority <= 2 ? ` (Priority ${task.priority})` : ''
    return {
      title: 'Task Reminder',
      body: `${task.content}${priorityLabel}`
    }
  }

  /**
   * Format notification content for an overdue task
   */
  formatOverdueNotification(task: Task): NotificationContent {
    return {
      title: 'Overdue Task',
      body: task.content
    }
  }

  /**
   * Show a native notification
   */
  showNotification(content: NotificationContent): void {
    if (!this.enabled) return
    if (this.isQuietTime()) return

    // Check if notifications are supported
    if (!Notification.isSupported()) {
      console.warn('Notifications not supported on this platform')
      return
    }

    const notification = new Notification({
      title: content.title,
      body: content.body,
      silent: false
    })

    notification.show()
  }

  /**
   * Show a task reminder notification
   */
  showTaskReminder(task: Task): void {
    const content = this.formatTaskNotification(task)
    this.showNotification(content)
  }

  /**
   * Show an overdue task notification
   */
  showOverdueReminder(task: Task): void {
    const content = this.formatOverdueNotification(task)
    this.showNotification(content)
  }

  /**
   * Enable or disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Set quiet hours during which no notifications are shown
   */
  setQuietHours(start: number, end: number): void {
    this.quietHoursStart = start
    this.quietHoursEnd = end
  }

  /**
   * Check if current time is within quiet hours
   */
  isQuietTime(date: Date = new Date()): boolean {
    const hour = date.getHours()
    if (this.quietHoursStart > this.quietHoursEnd) {
      // Quiet hours cross midnight (e.g., 22-7)
      return hour >= this.quietHoursStart || hour < this.quietHoursEnd
    }
    return hour >= this.quietHoursStart && hour < this.quietHoursEnd
  }

  /**
   * Calculate reminder time based on due date and offset
   */
  calculateReminderTime(dueDate: number, offsetMinutes: number): number {
    const reminderTime = dueDate - offsetMinutes * 60000
    const now = Date.now()
    return reminderTime > now ? reminderTime : now
  }

  /**
   * Request notification permissions (needed for some platforms)
   */
  async requestPermission(): Promise<boolean> {
    // On Electron, we don't need explicit permission for notifications
    // but we can check if the app has focus for notification behavior
    return Notification.isSupported()
  }
}

// Singleton instance
export const notificationService = new NotificationService()
