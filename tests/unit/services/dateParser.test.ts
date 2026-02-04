import { describe, it, expect, beforeEach } from 'vitest'
import { parseDate, parseRecurrence, parseDateWithRecurrence, formatDateForDisplay } from '@main/services/dateParser'

describe('dateParser', () => {
  const referenceDate = new Date('2024-03-15T10:00:00')

  describe('parseDate', () => {
    it('should parse "today"', () => {
      const result = parseDate('today', referenceDate)

      expect(result).toBeDefined()
      const date = new Date(result!.timestamp)
      expect(date.getDate()).toBe(15)
      expect(date.getMonth()).toBe(2) // March
    })

    it('should parse "tomorrow"', () => {
      const result = parseDate('tomorrow', referenceDate)

      expect(result).toBeDefined()
      const date = new Date(result!.timestamp)
      expect(date.getDate()).toBe(16)
    })

    it('should parse "next week"', () => {
      const result = parseDate('next week', referenceDate)

      expect(result).toBeDefined()
      const date = new Date(result!.timestamp)
      expect(date.getDate()).toBeGreaterThan(15)
    })

    it('should parse "monday"', () => {
      const result = parseDate('monday', referenceDate)

      expect(result).toBeDefined()
      const date = new Date(result!.timestamp)
      expect(date.getDay()).toBe(1) // Monday
    })

    it('should parse specific date "March 20"', () => {
      const result = parseDate('March 20', referenceDate)

      expect(result).toBeDefined()
      const date = new Date(result!.timestamp)
      expect(date.getMonth()).toBe(2) // March
      expect(date.getDate()).toBe(20)
    })

    it('should parse time "3pm"', () => {
      const result = parseDate('3pm', referenceDate)

      expect(result).toBeDefined()
      expect(result!.hasTime).toBe(true)
      const date = new Date(result!.timestamp)
      expect(date.getHours()).toBe(15)
    })

    it('should parse "tomorrow at 3pm"', () => {
      const result = parseDate('tomorrow at 3pm', referenceDate)

      expect(result).toBeDefined()
      expect(result!.hasTime).toBe(true)
      const date = new Date(result!.timestamp)
      expect(date.getDate()).toBe(16)
      expect(date.getHours()).toBe(15)
    })

    it('should parse "in 2 days"', () => {
      const result = parseDate('in 2 days', referenceDate)

      expect(result).toBeDefined()
      const date = new Date(result!.timestamp)
      expect(date.getDate()).toBe(17)
    })

    it('should return null for empty string', () => {
      expect(parseDate('')).toBeNull()
      expect(parseDate('   ')).toBeNull()
    })

    it('should return null for unparseable text', () => {
      expect(parseDate('asdfghjkl', referenceDate)).toBeNull()
    })
  })

  describe('parseRecurrence', () => {
    it('should parse "every day"', () => {
      const result = parseRecurrence('every day')
      expect(result).toBe('FREQ=DAILY')
    })

    it('should parse "daily"', () => {
      const result = parseRecurrence('daily')
      expect(result).toBe('FREQ=DAILY')
    })

    it('should parse "every week"', () => {
      const result = parseRecurrence('every week')
      expect(result).toBe('FREQ=WEEKLY')
    })

    it('should parse "weekly"', () => {
      const result = parseRecurrence('weekly')
      expect(result).toBe('FREQ=WEEKLY')
    })

    it('should parse "every month"', () => {
      const result = parseRecurrence('every month')
      expect(result).toBe('FREQ=MONTHLY')
    })

    it('should parse "every year"', () => {
      const result = parseRecurrence('every year')
      expect(result).toBe('FREQ=YEARLY')
    })

    it('should parse "every weekday"', () => {
      const result = parseRecurrence('every weekday')
      expect(result).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    })

    it('should parse "every weekend"', () => {
      const result = parseRecurrence('every weekend')
      expect(result).toBe('FREQ=WEEKLY;BYDAY=SA,SU')
    })

    it('should parse "every monday"', () => {
      const result = parseRecurrence('every monday')
      expect(result).toBe('FREQ=WEEKLY;BYDAY=MO')
    })

    it('should parse "every 2 weeks"', () => {
      const result = parseRecurrence('every 2 weeks')
      expect(result).toBe('FREQ=WEEKLY;INTERVAL=2')
    })

    it('should parse "every 3 days"', () => {
      const result = parseRecurrence('every 3 days')
      expect(result).toBe('FREQ=DAILY;INTERVAL=3')
    })

    it('should return null for non-recurrence text', () => {
      expect(parseRecurrence('tomorrow')).toBeNull()
      expect(parseRecurrence('March 15')).toBeNull()
    })
  })

  describe('parseDateWithRecurrence', () => {
    it('should parse date without recurrence', () => {
      const result = parseDateWithRecurrence('tomorrow', referenceDate)

      expect(result.date).toBeDefined()
      expect(result.recurrence).toBeNull()
    })

    it('should parse recurrence without date', () => {
      const result = parseDateWithRecurrence('every day', referenceDate)

      expect(result.recurrence).toBe('FREQ=DAILY')
    })

    it('should handle combined date and recurrence', () => {
      const result = parseDateWithRecurrence('every monday', referenceDate)

      expect(result.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO')
    })
  })

  describe('formatDateForDisplay', () => {
    it('should show "Today" for today\'s date', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      const result = formatDateForDisplay(today.getTime())
      expect(result).toBe('Today')
    })

    it('should show "Tomorrow" for tomorrow\'s date', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(12, 0, 0, 0)

      const result = formatDateForDisplay(tomorrow.getTime())
      expect(result).toBe('Tomorrow')
    })

    it('should show day name for dates within a week', () => {
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 3)
      nextWeek.setHours(23, 59, 59, 999)

      const result = formatDateForDisplay(nextWeek.getTime())
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      expect(days).toContain(result)
    })

    it('should show month and day for dates beyond a week', () => {
      const future = new Date()
      future.setDate(future.getDate() + 14)
      future.setHours(23, 59, 59, 999)

      const result = formatDateForDisplay(future.getTime())
      expect(result).toMatch(/\w+ \d+/)
    })

    it('should include time when specified', () => {
      const today = new Date()
      today.setHours(15, 30, 0, 0) // 3:30 PM

      const result = formatDateForDisplay(today.getTime(), true)
      expect(result).toContain('3:30 PM')
    })

    it('should not include time for end-of-day timestamps', () => {
      const today = new Date()
      today.setHours(23, 59, 0, 0)

      const result = formatDateForDisplay(today.getTime(), true)
      expect(result).not.toContain('11:59')
    })
  })
})
