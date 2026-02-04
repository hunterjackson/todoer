import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'
import { KarmaRepository } from '../../../src/main/db/repositories/karmaRepository'

describe('KarmaRepository', () => {
  let db: SqlJsDatabase
  let karmaRepo: KarmaRepository

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()

    // Create karma tables
    db.run(`
      CREATE TABLE karma_stats (
        id TEXT PRIMARY KEY DEFAULT 'default',
        total_points INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        daily_goal INTEGER NOT NULL DEFAULT 5,
        weekly_goal INTEGER NOT NULL DEFAULT 25
      )
    `)

    db.run(`
      CREATE TABLE karma_history (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0
      )
    `)

    karmaRepo = new KarmaRepository(db)
  })

  describe('getStats', () => {
    it('should return default stats when none exist', () => {
      const stats = karmaRepo.getStats()
      expect(stats.id).toBe('default')
      expect(stats.totalPoints).toBe(0)
      expect(stats.currentStreak).toBe(0)
      expect(stats.longestStreak).toBe(0)
      expect(stats.dailyGoal).toBe(5)
      expect(stats.weeklyGoal).toBe(25)
    })

    it('should return existing stats', () => {
      db.run(`
        INSERT INTO karma_stats (id, total_points, current_streak, longest_streak, daily_goal, weekly_goal)
        VALUES ('default', 100, 5, 10, 7, 35)
      `)

      const stats = karmaRepo.getStats()
      expect(stats.totalPoints).toBe(100)
      expect(stats.currentStreak).toBe(5)
      expect(stats.longestStreak).toBe(10)
      expect(stats.dailyGoal).toBe(7)
      expect(stats.weeklyGoal).toBe(35)
    })
  })

  describe('updateStats', () => {
    it('should update karma stats', () => {
      karmaRepo.getStats() // Initialize default

      const updated = karmaRepo.updateStats({
        totalPoints: 50,
        currentStreak: 3
      })

      expect(updated.totalPoints).toBe(50)
      expect(updated.currentStreak).toBe(3)
      expect(updated.dailyGoal).toBe(5) // Unchanged
    })
  })

  describe('addPoints', () => {
    it('should add points to total', () => {
      karmaRepo.getStats() // Initialize

      const stats = karmaRepo.addPoints(10)
      expect(stats.totalPoints).toBe(10)

      const stats2 = karmaRepo.addPoints(5)
      expect(stats2.totalPoints).toBe(15)
    })
  })

  describe('history operations', () => {
    it('should record and retrieve history', () => {
      const date = '2024-01-15'
      const history = karmaRepo.recordHistory(date, 10, 3)

      expect(history.date).toBe(date)
      expect(history.points).toBe(10)
      expect(history.tasksCompleted).toBe(3)

      const retrieved = karmaRepo.getHistoryForDate(date)
      expect(retrieved?.tasksCompleted).toBe(3)
    })

    it('should update existing history', () => {
      const date = '2024-01-15'
      karmaRepo.recordHistory(date, 10, 3)
      const updated = karmaRepo.recordHistory(date, 20, 5)

      expect(updated.points).toBe(20)
      expect(updated.tasksCompleted).toBe(5)

      const retrieved = karmaRepo.getHistoryForDate(date)
      expect(retrieved?.tasksCompleted).toBe(5)
    })

    it('should increment tasks completed', () => {
      const date = '2024-01-15'

      const h1 = karmaRepo.incrementTasksCompleted(date)
      expect(h1.tasksCompleted).toBe(1)

      const h2 = karmaRepo.incrementTasksCompleted(date)
      expect(h2.tasksCompleted).toBe(2)
    })

    it('should decrement tasks completed', () => {
      const date = '2024-01-15'
      karmaRepo.recordHistory(date, 0, 3)

      const result = karmaRepo.decrementTasksCompleted(date)
      expect(result?.tasksCompleted).toBe(2)
    })

    it('should not go below 0 when decrementing', () => {
      const date = '2024-01-15'
      karmaRepo.recordHistory(date, 0, 0)

      const result = karmaRepo.decrementTasksCompleted(date)
      expect(result?.tasksCompleted).toBe(0)
    })

    it('should get history for date range', () => {
      karmaRepo.recordHistory('2024-01-13', 10, 2)
      karmaRepo.recordHistory('2024-01-14', 15, 3)
      karmaRepo.recordHistory('2024-01-15', 20, 4)
      karmaRepo.recordHistory('2024-01-16', 5, 1)

      const history = karmaRepo.getHistory('2024-01-14', '2024-01-15')
      expect(history).toHaveLength(2)
    })

    it('should get total tasks completed in range', () => {
      karmaRepo.recordHistory('2024-01-14', 0, 3)
      karmaRepo.recordHistory('2024-01-15', 0, 5)

      const total = karmaRepo.getTotalTasksCompleted('2024-01-14', '2024-01-15')
      expect(total).toBe(8)
    })
  })

  describe('calculateStreak', () => {
    it('should return 0 when no history', () => {
      const streak = karmaRepo.calculateStreak()
      expect(streak).toBe(0)
    })

    it('should calculate streak for consecutive days', () => {
      // Mock dates - we'll use a fixed "today" for testing
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Record history for today and past days
      const todayStr = today.toISOString().split('T')[0]
      karmaRepo.recordHistory(todayStr, 0, 2)

      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      karmaRepo.recordHistory(yesterday.toISOString().split('T')[0], 0, 3)

      const twoDaysAgo = new Date(today)
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      karmaRepo.recordHistory(twoDaysAgo.toISOString().split('T')[0], 0, 1)

      const streak = karmaRepo.calculateStreak()
      expect(streak).toBe(3)
    })

    it('should return 0 when streak is broken', () => {
      // Record history for 3 days ago only
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const threeDaysAgo = new Date(today)
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      karmaRepo.recordHistory(threeDaysAgo.toISOString().split('T')[0], 0, 1)

      const streak = karmaRepo.calculateStreak()
      expect(streak).toBe(0)
    })

    it('should count streak starting from yesterday if no activity today', () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      karmaRepo.recordHistory(yesterday.toISOString().split('T')[0], 0, 2)

      const twoDaysAgo = new Date(today)
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      karmaRepo.recordHistory(twoDaysAgo.toISOString().split('T')[0], 0, 1)

      const streak = karmaRepo.calculateStreak()
      expect(streak).toBe(2)
    })
  })
})
