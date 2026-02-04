import { describe, it, expect } from 'vitest'
import {
  getRecurrenceInfo,
  getNextOccurrence,
  getOccurrences,
  createRRule,
  describeRecurrence,
  matchesRecurrence,
  calculateNextDueDate
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
  })
})
