import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'
import { KarmaRepository } from '../../../src/main/db/repositories/karmaRepository'
import { KarmaEngine } from '../../../src/main/services/karmaEngine'
import type { Task } from '../../../src/shared/types'
import { getLocalDateKey } from '../../../src/shared/utils'

describe('KarmaEngine', () => {
  let db: SqlJsDatabase
  let karmaRepo: KarmaRepository
  let karmaEngine: KarmaEngine

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
    karmaEngine = new KarmaEngine(karmaRepo)
  })

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    content: 'Test task',
    description: null,
    projectId: 'inbox',
    sectionId: null,
    parentId: null,
    dueDate: null,
    deadline: null,
    duration: null,
    recurrenceRule: null,
    priority: 4,
    completed: false,
    completedAt: null,
    sortOrder: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    labels: [],
    ...overrides
  })

  describe('getStats', () => {
    it('should return karma stats', () => {
      const stats = karmaEngine.getStats()
      expect(stats.totalPoints).toBe(0)
      expect(stats.currentStreak).toBe(0)
    })
  })

  describe('updateGoals', () => {
    it('should update daily and weekly goals', () => {
      const stats = karmaEngine.updateGoals(10, 50)
      expect(stats.dailyGoal).toBe(10)
      expect(stats.weeklyGoal).toBe(50)
    })
  })

  describe('recordTaskCompletion', () => {
    it('should award base points for completing a task', () => {
      const task = createMockTask()
      const result = karmaEngine.recordTaskCompletion(task)

      expect(result.points).toBeGreaterThan(0)
      expect(result.stats.totalPoints).toBeGreaterThan(0)
      expect(result.history.tasksCompleted).toBe(1)
    })

    it('should award bonus points for completing high priority tasks', () => {
      const lowPriorityTask = createMockTask({ priority: 4 })
      const highPriorityTask = createMockTask({ priority: 1 })

      const lowResult = karmaEngine.recordTaskCompletion(lowPriorityTask)

      // Reset for fair comparison
      karmaEngine.updateGoals(5, 25)
      karmaRepo.updateStats({ totalPoints: 0, currentStreak: 0 })

      const highResult = karmaEngine.recordTaskCompletion(highPriorityTask)

      expect(highResult.points).toBeGreaterThan(lowResult.points)
    })

    it('should award bonus points for completing on time', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const taskWithFutureDue = createMockTask({ dueDate: tomorrow.getTime() })
      const taskWithNoDue = createMockTask({ dueDate: null })

      const withDueResult = karmaEngine.recordTaskCompletion(taskWithFutureDue)

      // Reset
      karmaRepo.updateStats({ totalPoints: 0 })

      const noDueResult = karmaEngine.recordTaskCompletion(taskWithNoDue)

      expect(withDueResult.points).toBeGreaterThan(noDueResult.points)
    })

    it('should increment tasks completed in history', () => {
      const task1 = createMockTask({ id: 'task-1' })
      const task2 = createMockTask({ id: 'task-2' })

      karmaEngine.recordTaskCompletion(task1)
      const result = karmaEngine.recordTaskCompletion(task2)

      expect(result.history.tasksCompleted).toBe(2)
    })
  })

  describe('recordTaskUncompletion', () => {
    it('should subtract points when uncompleting a task', () => {
      const task = createMockTask()
      karmaEngine.recordTaskCompletion(task)

      const initialPoints = karmaEngine.getStats().totalPoints
      karmaEngine.recordTaskUncompletion(task)

      const finalPoints = karmaEngine.getStats().totalPoints
      expect(finalPoints).toBeLessThan(initialPoints)
    })

    it('should not go below 0 points', () => {
      const task = createMockTask()
      karmaEngine.recordTaskUncompletion(task)

      const stats = karmaEngine.getStats()
      expect(stats.totalPoints).toBe(0)
    })
  })

  describe('getTodayStats', () => {
    it('should return today stats', () => {
      const task = createMockTask()
      karmaEngine.recordTaskCompletion(task)

      const todayStats = karmaEngine.getTodayStats()
      expect(todayStats.tasksCompleted).toBe(1)
      expect(todayStats.dailyGoal).toBe(5)
      expect(todayStats.progress).toBe(20) // 1/5 = 20%
      expect(todayStats.goalMet).toBe(false)
    })

    it('should show goal met when reached', () => {
      karmaEngine.updateGoals(2, 10)

      const task1 = createMockTask({ id: 'task-1' })
      const task2 = createMockTask({ id: 'task-2' })

      karmaEngine.recordTaskCompletion(task1)
      karmaEngine.recordTaskCompletion(task2)

      const todayStats = karmaEngine.getTodayStats()
      expect(todayStats.goalMet).toBe(true)
      expect(todayStats.progress).toBe(100)
    })
  })

  describe('getWeekStats', () => {
    it('should return week stats', () => {
      const task = createMockTask()
      karmaEngine.recordTaskCompletion(task)

      const weekStats = karmaEngine.getWeekStats()
      expect(weekStats.tasksCompleted).toBeGreaterThanOrEqual(1)
      expect(weekStats.weeklyGoal).toBe(25)
      expect(weekStats.daysActive).toBe(1)
    })
  })

  describe('getProductivitySummary', () => {
    it('should return comprehensive summary', () => {
      const task = createMockTask()
      karmaEngine.recordTaskCompletion(task)

      const summary = karmaEngine.getProductivitySummary()

      expect(summary.karma).toBeDefined()
      expect(summary.today).toBeDefined()
      expect(summary.week).toBeDefined()
      expect(summary.today.tasksCompleted).toBe(1)
    })
  })

  describe('karma varies with due date (recurring-undo fix)', () => {
    it('should award on-time bonus when due date is in the future', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const task = createMockTask({ dueDate: futureDate.getTime() })
      const result = karmaEngine.recordTaskCompletion(task)

      // TASK_COMPLETED (1) + TASK_COMPLETED_ON_TIME (2) = 3
      expect(result.points).toBe(3)
    })

    it('should not award on-time bonus when due date is in the past', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 7)

      const task = createMockTask({ dueDate: pastDate.getTime() })
      const result = karmaEngine.recordTaskCompletion(task)

      // TASK_COMPLETED (1) only, no on-time bonus
      expect(result.points).toBe(1)
    })

    it('should subtract correct amount based on due date during uncompletion', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const task = createMockTask({ dueDate: futureDate.getTime() })
      karmaEngine.recordTaskCompletion(task)

      const pointsBefore = karmaEngine.getStats().totalPoints
      const uncompResult = karmaEngine.recordTaskUncompletion(task)

      // Should subtract same 3 points that were awarded
      expect(uncompResult.points).toBe(-3)
      expect(karmaEngine.getStats().totalPoints).toBe(pointsBefore - 3)
    })
  })

  describe('updateStreak', () => {
    it('should update current streak', () => {
      const today = getLocalDateKey()
      karmaRepo.recordHistory(today, 0, 1)

      karmaEngine.updateStreak()
      const stats = karmaEngine.getStats()

      expect(stats.currentStreak).toBe(1)
    })

    it('should update longest streak when current exceeds it', () => {
      const now = new Date()

      // Create a 3-day streak
      for (let i = 0; i < 3; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        karmaRepo.recordHistory(getLocalDateKey(date), 0, 1)
      }

      karmaEngine.updateStreak()
      const stats = karmaEngine.getStats()

      expect(stats.currentStreak).toBe(3)
      expect(stats.longestStreak).toBe(3)
    })
  })
})
