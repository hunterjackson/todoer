import { describe, it, expect } from 'vitest'
import {
  getRecurrenceInfo,
  getNextOccurrence,
  getOccurrences,
  createRRule,
  describeRecurrence,
  matchesRecurrence,
  calculateNextDueDate,
  calculateRecurringRescheduleDate,
  isCompletionBasedRecurrence,
  getActualRRule,
  createCompletionBasedRule
} from '@main/services/recurrenceEngine'

describe('recurrenceEngine', () => {
  describe('getRecurrenceInfo', () => {
    it('should get info for daily recurrence', () => {
      const info = getRecurrenceInfo('FREQ=DAILY')

      expect(info.rule).toBe('FREQ=DAILY')
      expect(info.description).toContain('day')
      expect(info.nextOccurrence).toBeDefined()
    })

    it('should get info for weekly recurrence', () => {
      const info = getRecurrenceInfo('FREQ=WEEKLY')

      expect(info.description).toContain('week')
    })

    it('should handle invalid rule', () => {
      const info = getRecurrenceInfo('invalid-rule')

      expect(info.description).toBe('Invalid recurrence rule')
    })
  })

  describe('getNextOccurrence', () => {
    it('should get next occurrence for daily rule', () => {
      const today = new Date()
      const next = getNextOccurrence('FREQ=DAILY', today)

      expect(next).toBeDefined()
      expect(next).toBeGreaterThan(today.getTime())
    })

    it('should get next occurrence for weekly rule', () => {
      const today = new Date()
      const next = getNextOccurrence('FREQ=WEEKLY', today)

      expect(next).toBeDefined()
      const diff = next! - today.getTime()
      expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000) // 7 days + buffer
    })

    it('should return null for invalid rule', () => {
      const result = getNextOccurrence('invalid-rule')
      expect(result).toBeNull()
    })
  })

  describe('getOccurrences', () => {
    it('should get multiple occurrences', () => {
      const occurrences = getOccurrences('FREQ=DAILY', 5)

      expect(occurrences).toHaveLength(5)
      // Each occurrence should be after the previous
      for (let i = 1; i < occurrences.length; i++) {
        expect(occurrences[i]).toBeGreaterThan(occurrences[i - 1])
      }
    })

    it('should return empty array for invalid rule', () => {
      const result = getOccurrences('invalid-rule', 5)
      expect(result).toHaveLength(0)
    })
  })

  describe('createRRule', () => {
    it('should create daily rule', () => {
      const rule = createRRule({ frequency: 'daily' })
      expect(rule).toContain('FREQ=DAILY')
    })

    it('should create weekly rule', () => {
      const rule = createRRule({ frequency: 'weekly' })
      expect(rule).toContain('FREQ=WEEKLY')
    })

    it('should create monthly rule', () => {
      const rule = createRRule({ frequency: 'monthly' })
      expect(rule).toContain('FREQ=MONTHLY')
    })

    it('should create yearly rule', () => {
      const rule = createRRule({ frequency: 'yearly' })
      expect(rule).toContain('FREQ=YEARLY')
    })

    it('should include interval', () => {
      const rule = createRRule({ frequency: 'daily', interval: 3 })
      expect(rule).toContain('INTERVAL=3')
    })

    it('should include weekday constraint', () => {
      const rule = createRRule({
        frequency: 'weekly',
        byWeekDay: [0, 2, 4] // Mon, Wed, Fri
      })
      expect(rule).toContain('BYDAY')
    })

    it('should include count limit', () => {
      const rule = createRRule({ frequency: 'daily', count: 10 })
      expect(rule).toContain('COUNT=10')
    })
  })

  describe('describeRecurrence', () => {
    it('should describe daily rule', () => {
      const desc = describeRecurrence('FREQ=DAILY')
      expect(desc.toLowerCase()).toContain('day')
    })

    it('should describe weekly rule', () => {
      const desc = describeRecurrence('FREQ=WEEKLY')
      expect(desc.toLowerCase()).toContain('week')
    })

    it('should describe rule with interval', () => {
      const desc = describeRecurrence('FREQ=DAILY;INTERVAL=2')
      expect(desc.toLowerCase()).toContain('2')
    })

    it('should handle invalid rule', () => {
      const desc = describeRecurrence('invalid')
      expect(desc).toBe('Custom recurrence')
    })
  })

  describe('matchesRecurrence', () => {
    it('should match daily recurrence', () => {
      const today = new Date()
      const matches = matchesRecurrence('FREQ=DAILY', today)
      expect(matches).toBe(true)
    })

    it('should match specific weekday', () => {
      // Create a date that's a Monday
      const monday = new Date('2024-03-18') // This is a Monday
      const rule = 'FREQ=WEEKLY;BYDAY=MO'

      const matches = matchesRecurrence(rule, monday)
      expect(matches).toBe(true)
    })

    it('should not match wrong weekday', () => {
      // Create a date that's a Tuesday
      const tuesday = new Date('2024-03-19') // This is a Tuesday
      const rule = 'FREQ=WEEKLY;BYDAY=MO'

      const matches = matchesRecurrence(rule, tuesday)
      expect(matches).toBe(false)
    })
  })

  describe('calculateNextDueDate', () => {
    it('should calculate next due date for daily rule', () => {
      const currentDue = new Date('2024-03-15').getTime()
      const completedAt = new Date('2024-03-15').getTime()

      const next = calculateNextDueDate('FREQ=DAILY', currentDue, completedAt)

      expect(next).toBeDefined()
      expect(next).toBeGreaterThan(currentDue)
    })

    it('should calculate next due date for weekly rule', () => {
      const currentDue = new Date('2024-03-15T12:00:00Z').getTime()
      const completedAt = new Date('2024-03-15T12:00:00Z').getTime()

      const next = calculateNextDueDate('FREQ=WEEKLY', currentDue, completedAt)

      expect(next).toBeDefined()
      expect(next).toBeGreaterThan(currentDue)
      // Should return a future occurrence
      const diff = next! - currentDue
      // Weekly rule should return next week (7 days ± some buffer for timezone)
      expect(diff).toBeLessThanOrEqual(14 * 24 * 60 * 60 * 1000) // Within 2 weeks
    })

    it('should return null for invalid rule', () => {
      const result = calculateNextDueDate('invalid', Date.now(), Date.now())
      expect(result).toBeNull()
    })

    // Completion-based recurrence tests
    it('should use completion date for completion-based recurrence', () => {
      // Due date was Jan 1, but completed early on Dec 30
      // For completion-based, next should be calculated from Dec 30
      const dueDate = new Date('2024-01-01T12:00:00Z').getTime()
      const completedAt = new Date('2023-12-30T12:00:00Z').getTime()

      // Regular recurrence - uses the later of dueDate and completedAt
      const regularNext = calculateNextDueDate('FREQ=DAILY;INTERVAL=3', dueDate, completedAt)

      // Completion-based - uses completedAt
      const completionBasedNext = calculateNextDueDate('COMPLETION:FREQ=DAILY;INTERVAL=3', dueDate, completedAt)

      // Both should return valid dates
      expect(regularNext).toBeDefined()
      expect(completionBasedNext).toBeDefined()

      // Completion-based should be earlier (based on completedAt, not dueDate)
      expect(completionBasedNext).toBeLessThan(regularNext!)
    })

    it('should calculate completion-based next date correctly', () => {
      // Completed on Jan 15
      const completedAt = new Date('2024-01-15T10:00:00Z').getTime()
      const dueDate = new Date('2024-01-10T10:00:00Z').getTime() // Due date was earlier

      // Every day from completion
      const next = calculateNextDueDate('COMPLETION:FREQ=DAILY', dueDate, completedAt)

      // Should be in the future after completion
      expect(next).toBeDefined()
      expect(next!).toBeGreaterThan(completedAt)

      // Should be within 2 days (allowing for timezone/rrule behavior)
      const daysDiff = (next! - completedAt) / (24 * 60 * 60 * 1000)
      expect(daysDiff).toBeLessThanOrEqual(2)
    })
  })

  describe('calculateRecurringRescheduleDate', () => {
    it('returns next due date for recurring tasks that have no current dueDate', () => {
      const completedAt = new Date('2024-03-15T10:00:00Z').getTime()
      const next = calculateRecurringRescheduleDate('FREQ=DAILY', null, completedAt)

      expect(next).not.toBeNull()
      expect(next!).toBeGreaterThan(completedAt)
    })

    it('returns null when recurrence rule is missing', () => {
      const completedAt = Date.now()
      const next = calculateRecurringRescheduleDate(null, null, completedAt)

      expect(next).toBeNull()
    })
  })

  describe('isCompletionBasedRecurrence', () => {
    it('should identify completion-based rules', () => {
      expect(isCompletionBasedRecurrence('COMPLETION:FREQ=DAILY')).toBe(true)
      expect(isCompletionBasedRecurrence('FREQ=DAILY')).toBe(false)
    })
  })

  describe('getActualRRule', () => {
    it('should extract actual rrule from prefixed string', () => {
      expect(getActualRRule('COMPLETION:FREQ=DAILY')).toBe('FREQ=DAILY')
      expect(getActualRRule('FREQ=WEEKLY')).toBe('FREQ=WEEKLY')
    })
  })

  describe('createCompletionBasedRule', () => {
    it('should add completion prefix', () => {
      expect(createCompletionBasedRule('FREQ=DAILY')).toBe('COMPLETION:FREQ=DAILY')
    })

    it('should not double-prefix', () => {
      expect(createCompletionBasedRule('COMPLETION:FREQ=DAILY')).toBe('COMPLETION:FREQ=DAILY')
    })
  })
})
