import type { Database as SqlJsDatabase } from 'sql.js'
import type { KarmaStats, KarmaHistory } from '@shared/types'
import { BaseRepository } from './baseRepository'
import { generateId, getLocalDateKey } from '@shared/utils'

interface KarmaStatsRow {
  id: string
  total_points: number
  current_streak: number
  longest_streak: number
  daily_goal: number
  weekly_goal: number
}

interface KarmaHistoryRow {
  id: string
  date: string
  points: number
  tasks_completed: number
}

export class KarmaRepository extends BaseRepository<KarmaStatsRow, KarmaStats> {
  constructor(db: SqlJsDatabase) {
    super(db)
  }

  protected rowToEntity(row: KarmaStatsRow): KarmaStats {
    return {
      id: row.id,
      totalPoints: row.total_points,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      dailyGoal: row.daily_goal,
      weeklyGoal: row.weekly_goal
    }
  }

  protected historyRowToEntity(row: KarmaHistoryRow): KarmaHistory {
    return {
      id: row.id,
      date: row.date,
      points: row.points,
      tasksCompleted: row.tasks_completed
    }
  }

  /**
   * Get the current karma stats
   */
  getStats(): KarmaStats {
    const row = this.queryOne<KarmaStatsRow>(
      `SELECT * FROM karma_stats WHERE id = 'default'`
    )
    if (!row) {
      // Create default stats if not exists
      this.run(`
        INSERT INTO karma_stats (id, total_points, current_streak, longest_streak, daily_goal, weekly_goal)
        VALUES ('default', 0, 0, 0, 5, 25)
      `)
      return {
        id: 'default',
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        dailyGoal: 5,
        weeklyGoal: 25
      }
    }
    return this.rowToEntity(row)
  }

  /**
   * Update karma stats
   */
  updateStats(updates: Partial<Omit<KarmaStats, 'id'>>): KarmaStats {
    const current = this.getStats()
    const updated = { ...current, ...updates }

    this.run(
      `UPDATE karma_stats SET
        total_points = ?,
        current_streak = ?,
        longest_streak = ?,
        daily_goal = ?,
        weekly_goal = ?
      WHERE id = 'default'`,
      [updated.totalPoints, updated.currentStreak, updated.longestStreak, updated.dailyGoal, updated.weeklyGoal]
    )

    return updated
  }

  /**
   * Add points to total
   */
  addPoints(points: number): KarmaStats {
    const current = this.getStats()
    return this.updateStats({ totalPoints: current.totalPoints + points })
  }

  /**
   * Get karma history for a date range
   */
  getHistory(startDate: string, endDate: string): KarmaHistory[] {
    const rows = this.queryAll<KarmaHistoryRow>(
      `SELECT * FROM karma_history WHERE date >= ? AND date <= ? ORDER BY date DESC`,
      [startDate, endDate]
    )
    return rows.map((row) => this.historyRowToEntity(row))
  }

  /**
   * Get history for a specific date
   */
  getHistoryForDate(date: string): KarmaHistory | null {
    const row = this.queryOne<KarmaHistoryRow>(
      `SELECT * FROM karma_history WHERE date = ?`,
      [date]
    )
    return row ? this.historyRowToEntity(row) : null
  }

  /**
   * Record or update karma history for a date
   */
  recordHistory(date: string, points: number, tasksCompleted: number): KarmaHistory {
    const existing = this.getHistoryForDate(date)

    if (existing) {
      this.run(
        `UPDATE karma_history SET points = ?, tasks_completed = ? WHERE date = ?`,
        [points, tasksCompleted, date]
      )
      return { ...existing, points, tasksCompleted }
    } else {
      const id = generateId()
      this.run(
        `INSERT INTO karma_history (id, date, points, tasks_completed) VALUES (?, ?, ?, ?)`,
        [id, date, points, tasksCompleted]
      )
      return { id, date, points, tasksCompleted }
    }
  }

  /**
   * Increment tasks completed for today
   */
  incrementTasksCompleted(date: string): KarmaHistory {
    const existing = this.getHistoryForDate(date)

    if (existing) {
      return this.recordHistory(date, existing.points, existing.tasksCompleted + 1)
    } else {
      return this.recordHistory(date, 0, 1)
    }
  }

  /**
   * Decrement tasks completed for today (for undo)
   */
  decrementTasksCompleted(date: string): KarmaHistory | null {
    const existing = this.getHistoryForDate(date)

    if (existing && existing.tasksCompleted > 0) {
      return this.recordHistory(date, existing.points, existing.tasksCompleted - 1)
    }
    return existing
  }

  /**
   * Get total tasks completed in a date range
   */
  getTotalTasksCompleted(startDate: string, endDate: string): number {
    const result = this.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(tasks_completed), 0) as total FROM karma_history WHERE date >= ? AND date <= ?`,
      [startDate, endDate]
    )
    return result?.total ?? 0
  }

  /**
   * Get the number of consecutive days with completed tasks (streak)
   */
  calculateStreak(): number {
    // Get all history ordered by date descending
    const rows = this.queryAll<KarmaHistoryRow>(
      `SELECT * FROM karma_history WHERE tasks_completed > 0 ORDER BY date DESC`
    )

    if (rows.length === 0) return 0

    let streak = 0
    const now = new Date()

    // Use local date keys consistently
    const todayStr = getLocalDateKey(now)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = getLocalDateKey(yesterday)

    const firstDate = rows[0]?.date
    if (firstDate !== todayStr && firstDate !== yesterdayStr) {
      // Streak is broken if most recent activity isn't today or yesterday
      return 0
    }

    // Count consecutive days - start from the first date in history
    const expectedDate = new Date(now)
    if (firstDate !== todayStr) {
      expectedDate.setDate(expectedDate.getDate() - 1)
    }

    for (const row of rows) {
      const rowDate = row.date
      const expected = getLocalDateKey(expectedDate)

      if (rowDate === expected) {
        streak++
        expectedDate.setDate(expectedDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  }
}
