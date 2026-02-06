import type { KarmaStats, KarmaHistory, Task } from '@shared/types'
import type { KarmaRepository } from '../db/repositories/karmaRepository'
import { getLocalDateKey } from '@shared/utils'

interface TodayStats {
  tasksCompleted: number
  dailyGoal: number
  progress: number
  goalMet: boolean
}

interface WeekStats {
  tasksCompleted: number
  weeklyGoal: number
  progress: number
  goalMet: boolean
  daysActive: number
}

/**
 * Points awarded for various actions
 */
const POINTS = {
  TASK_COMPLETED: 1,
  TASK_COMPLETED_ON_TIME: 2, // If completed before or on due date
  TASK_COMPLETED_OVERDUE: 0, // No bonus for overdue tasks
  HIGH_PRIORITY_BONUS: 1, // Bonus for P1-P2 tasks
  DAILY_GOAL_MET: 5,
  WEEKLY_GOAL_MET: 10
}

export class KarmaEngine {
  constructor(private karmaRepo: KarmaRepository) {}

  /**
   * Get current karma stats
   */
  getStats(): KarmaStats {
    return this.karmaRepo.getStats()
  }

  /**
   * Update daily/weekly goals
   */
  updateGoals(dailyGoal?: number, weeklyGoal?: number): KarmaStats {
    const updates: Partial<KarmaStats> = {}
    if (dailyGoal !== undefined) updates.dailyGoal = dailyGoal
    if (weeklyGoal !== undefined) updates.weeklyGoal = weeklyGoal
    return this.karmaRepo.updateStats(updates)
  }

  /**
   * Record a task completion and award points
   */
  recordTaskCompletion(task: Task): { points: number; stats: KarmaStats; history: KarmaHistory } {
    const today = getLocalDateKey()
    let points = POINTS.TASK_COMPLETED

    // Bonus for completing on time
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      const now = new Date()
      if (now <= dueDate) {
        points += POINTS.TASK_COMPLETED_ON_TIME
      }
    }

    // Bonus for high priority tasks
    if (task.priority <= 2) {
      points += POINTS.HIGH_PRIORITY_BONUS
    }

    // Add points to total
    const stats = this.karmaRepo.addPoints(points)

    // Record in history
    const history = this.karmaRepo.incrementTasksCompleted(today)

    // Check if daily goal was just met
    const currentStats = this.karmaRepo.getStats()
    if (history.tasksCompleted === currentStats.dailyGoal) {
      this.karmaRepo.addPoints(POINTS.DAILY_GOAL_MET)
    }

    // Update streak
    this.updateStreak()

    return {
      points,
      stats: this.karmaRepo.getStats(),
      history
    }
  }

  /**
   * Record a task uncompletion (undo) - subtract points
   */
  recordTaskUncompletion(task: Task): { points: number; stats: KarmaStats } {
    const today = getLocalDateKey()
    let points = POINTS.TASK_COMPLETED

    // Same calculation as completion
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      const now = new Date()
      if (now <= dueDate) {
        points += POINTS.TASK_COMPLETED_ON_TIME
      }
    }

    if (task.priority <= 2) {
      points += POINTS.HIGH_PRIORITY_BONUS
    }

    // Subtract points (don't go below 0)
    const current = this.karmaRepo.getStats()
    const newTotal = Math.max(0, current.totalPoints - points)
    const stats = this.karmaRepo.updateStats({ totalPoints: newTotal })

    // Decrement history
    this.karmaRepo.decrementTasksCompleted(today)

    return { points: -points, stats }
  }

  /**
   * Update the streak calculation
   */
  updateStreak(): KarmaStats {
    const newStreak = this.karmaRepo.calculateStreak()
    const current = this.karmaRepo.getStats()

    const updates: Partial<KarmaStats> = {
      currentStreak: newStreak
    }

    // Update longest streak if current is greater
    if (newStreak > current.longestStreak) {
      updates.longestStreak = newStreak
    }

    return this.karmaRepo.updateStats(updates)
  }

  /**
   * Get karma history for a date range
   */
  getHistory(startDate: string, endDate: string): KarmaHistory[] {
    return this.karmaRepo.getHistory(startDate, endDate)
  }

  /**
   * Get today's history
   */
  getTodayHistory(): KarmaHistory | null {
    const today = getLocalDateKey()
    return this.karmaRepo.getHistoryForDate(today)
  }

  /**
   * Get productivity stats for today
   */
  getTodayStats(): TodayStats {
    const stats = this.karmaRepo.getStats()
    const today = this.getTodayHistory()
    const tasksCompleted = today?.tasksCompleted ?? 0

    return {
      tasksCompleted,
      dailyGoal: stats.dailyGoal,
      progress: Math.min(100, Math.round((tasksCompleted / stats.dailyGoal) * 100)),
      goalMet: tasksCompleted >= stats.dailyGoal
    }
  }

  /**
   * Get weekly stats
   */
  getWeekStats(): WeekStats {
    const stats = this.karmaRepo.getStats()

    // Get start of week (Sunday)
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const startStr = startOfWeek.toISOString().split('T')[0]
    const endStr = today.toISOString().split('T')[0]

    const history = this.karmaRepo.getHistory(startStr, endStr)
    const tasksCompleted = history.reduce((sum, h) => sum + h.tasksCompleted, 0)
    const daysActive = history.filter((h) => h.tasksCompleted > 0).length

    return {
      tasksCompleted,
      weeklyGoal: stats.weeklyGoal,
      progress: Math.min(100, Math.round((tasksCompleted / stats.weeklyGoal) * 100)),
      goalMet: tasksCompleted >= stats.weeklyGoal,
      daysActive
    }
  }

  /**
   * Get comprehensive productivity summary
   */
  getProductivitySummary(): {
    karma: KarmaStats
    today: TodayStats
    week: WeekStats
  } {
    return {
      karma: this.getStats(),
      today: this.getTodayStats(),
      week: this.getWeekStats()
    }
  }
}
