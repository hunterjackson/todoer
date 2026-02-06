import { describe, it, expect } from 'vitest'
import {
  generateId,
  now,
  startOfDay,
  endOfDay,
  addDays,
  isToday,
  isTomorrow,
  isOverdue,
  isWithinDays,
  calculateSortOrder,
  deepClone,
  groupBy,
  sortBy,
  escapeHtml,
  topologicalSort,
  sanitizeFilename
} from '@shared/utils'

describe('utils', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })

    it('should generate IDs of consistent length', () => {
      const ids = Array.from({ length: 10 }, () => generateId())
      const lengths = ids.map((id) => id.length)

      expect(new Set(lengths).size).toBe(1)
    })
  })

  describe('now', () => {
    it('should return current timestamp', () => {
      const before = Date.now()
      const result = now()
      const after = Date.now()

      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })
  })

  describe('startOfDay', () => {
    it('should return start of current day', () => {
      const result = startOfDay()
      const date = new Date(result)

      expect(date.getHours()).toBe(0)
      expect(date.getMinutes()).toBe(0)
      expect(date.getSeconds()).toBe(0)
      expect(date.getMilliseconds()).toBe(0)
    })

    it('should return start of specified day', () => {
      const input = new Date('2024-03-15T14:30:00')
      const result = startOfDay(input)
      const date = new Date(result)

      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(2)
      expect(date.getDate()).toBe(15)
      expect(date.getHours()).toBe(0)
    })
  })

  describe('endOfDay', () => {
    it('should return end of current day', () => {
      const result = endOfDay()
      const date = new Date(result)

      expect(date.getHours()).toBe(23)
      expect(date.getMinutes()).toBe(59)
      expect(date.getSeconds()).toBe(59)
      expect(date.getMilliseconds()).toBe(999)
    })
  })

  describe('addDays', () => {
    it('should add days to timestamp', () => {
      const start = new Date('2024-03-15T12:00:00').getTime()
      const result = addDays(start, 5)
      const date = new Date(result)

      // Check it's 5 days later
      const diffDays = Math.round((result - start) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(5)
    })

    it('should handle negative days', () => {
      const start = new Date('2024-03-15T12:00:00').getTime()
      const result = addDays(start, -5)

      // Check it's 5 days earlier
      const diffDays = Math.round((start - result) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(5)
    })

    it('should handle month boundaries', () => {
      const start = new Date('2024-03-30T12:00:00').getTime()
      const result = addDays(start, 5)
      const date = new Date(result)

      // Should be in April
      expect(date.getMonth()).toBe(3) // April
    })
  })

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      expect(isToday(today.getTime())).toBe(true)
    })

    it('should return false for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      expect(isToday(yesterday.getTime())).toBe(false)
    })

    it('should return false for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      expect(isToday(tomorrow.getTime())).toBe(false)
    })
  })

  describe('isTomorrow', () => {
    it('should return true for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(12, 0, 0, 0)

      expect(isTomorrow(tomorrow.getTime())).toBe(true)
    })

    it('should return false for today', () => {
      const today = new Date()

      expect(isTomorrow(today.getTime())).toBe(false)
    })
  })

  describe('isOverdue', () => {
    it('should return true for past dates', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      expect(isOverdue(yesterday.getTime())).toBe(true)
    })

    it('should return false for today', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      expect(isOverdue(today.getTime())).toBe(false)
    })

    it('should return false for future dates', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      expect(isOverdue(tomorrow.getTime())).toBe(false)
    })
  })

  describe('isWithinDays', () => {
    it('should return true for dates within range', () => {
      const inRange = new Date()
      inRange.setDate(inRange.getDate() + 3)

      expect(isWithinDays(inRange.getTime(), 7)).toBe(true)
    })

    it('should return false for dates outside range', () => {
      const outOfRange = new Date()
      outOfRange.setDate(outOfRange.getDate() + 10)

      expect(isWithinDays(outOfRange.getTime(), 7)).toBe(false)
    })

    it('should include today', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      expect(isWithinDays(today.getTime(), 7)).toBe(true)
    })
  })

  describe('calculateSortOrder', () => {
    it('should return 1 when both null', () => {
      expect(calculateSortOrder(null, null)).toBe(1)
    })

    it('should return half of after when before is null', () => {
      expect(calculateSortOrder(null, 2)).toBe(1)
    })

    it('should return before + 1 when after is null', () => {
      expect(calculateSortOrder(5, null)).toBe(6)
    })

    it('should return midpoint between before and after', () => {
      expect(calculateSortOrder(1, 3)).toBe(2)
      expect(calculateSortOrder(1, 2)).toBe(1.5)
    })
  })

  describe('deepClone', () => {
    it('should clone simple objects', () => {
      const obj = { a: 1, b: 'test' }
      const clone = deepClone(obj)

      expect(clone).toEqual(obj)
      expect(clone).not.toBe(obj)
    })

    it('should clone nested objects', () => {
      const obj = { a: { b: { c: 1 } } }
      const clone = deepClone(obj)

      expect(clone).toEqual(obj)
      expect(clone.a).not.toBe(obj.a)
      expect(clone.a.b).not.toBe(obj.a.b)
    })

    it('should clone arrays', () => {
      const arr = [1, 2, [3, 4]]
      const clone = deepClone(arr)

      expect(clone).toEqual(arr)
      expect(clone).not.toBe(arr)
      expect(clone[2]).not.toBe(arr[2])
    })
  })

  describe('groupBy', () => {
    it('should group by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ]

      const grouped = groupBy(items, 'type')

      expect(grouped['a']).toHaveLength(2)
      expect(grouped['b']).toHaveLength(1)
    })
  })

  describe('sortBy', () => {
    it('should sort by single key', () => {
      const items = [{ n: 3 }, { n: 1 }, { n: 2 }]
      const sorted = sortBy(items, 'n')

      expect(sorted[0].n).toBe(1)
      expect(sorted[1].n).toBe(2)
      expect(sorted[2].n).toBe(3)
    })

    it('should sort by multiple keys', () => {
      const items = [
        { a: 1, b: 2 },
        { a: 1, b: 1 },
        { a: 2, b: 1 }
      ]
      const sorted = sortBy(items, 'a', 'b')

      expect(sorted[0]).toEqual({ a: 1, b: 1 })
      expect(sorted[1]).toEqual({ a: 1, b: 2 })
      expect(sorted[2]).toEqual({ a: 2, b: 1 })
    })

    it('should not mutate original array', () => {
      const items = [{ n: 3 }, { n: 1 }]
      sortBy(items, 'n')

      expect(items[0].n).toBe(3)
    })
  })

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
      expect(escapeHtml('"test"')).toBe('&quot;test&quot;')
      expect(escapeHtml("'test'")).toBe('&#039;test&#039;')
      expect(escapeHtml('a & b')).toBe('a &amp; b')
    })

    it('should leave safe text unchanged', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('topologicalSort', () => {
    it('should sort parents before children for deep nesting', () => {
      // Deliberately reversed: grandchild, child, root
      const items = [
        { id: 'c', parentId: 'b' },
        { id: 'b', parentId: 'a' },
        { id: 'a', parentId: null },
      ]
      const sorted = topologicalSort(items)
      const ids = sorted.map(i => i.id)
      expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'))
      expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'))
    })

    it('should handle multiple roots', () => {
      const items = [
        { id: 'b1', parentId: 'a' },
        { id: 'a', parentId: null },
        { id: 'd', parentId: 'c' },
        { id: 'c', parentId: null },
      ]
      const sorted = topologicalSort(items)
      const ids = sorted.map(i => i.id)
      expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b1'))
      expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'))
    })

    it('should treat items with unknown parents as roots', () => {
      const items = [
        { id: 'b', parentId: 'unknown' },
        { id: 'a', parentId: null },
      ]
      const sorted = topologicalSort(items)
      expect(sorted).toHaveLength(2)
      // Both should be present
      expect(sorted.map(i => i.id)).toContain('a')
      expect(sorted.map(i => i.id)).toContain('b')
    })

    it('should handle empty input', () => {
      expect(topologicalSort([])).toEqual([])
    })

    it('should handle 4-level deep nesting in worst-case order', () => {
      const items = [
        { id: 'd', parentId: 'c' },
        { id: 'b', parentId: 'a' },
        { id: 'c', parentId: 'b' },
        { id: 'a', parentId: null },
      ]
      const sorted = topologicalSort(items)
      const ids = sorted.map(i => i.id)
      expect(ids).toEqual(['a', 'b', 'c', 'd'])
    })
  })

  describe('sanitizeFilename', () => {
    it('should pass through a simple filename', () => {
      expect(sanitizeFilename('document.pdf')).toBe('document.pdf')
    })

    it('should strip directory traversal with ../', () => {
      expect(sanitizeFilename('../../etc/passwd')).toBe('passwd')
    })

    it('should strip absolute Unix paths', () => {
      expect(sanitizeFilename('/etc/shadow')).toBe('shadow')
    })

    it('should strip Windows-style paths', () => {
      expect(sanitizeFilename('C:\\Windows\\System32\\evil.exe')).toBe('evil.exe')
    })

    it('should strip leading dots', () => {
      expect(sanitizeFilename('.bashrc')).toBe('bashrc')
    })

    it('should strip null bytes', () => {
      expect(sanitizeFilename('file\0.txt')).toBe('file.txt')
    })

    it('should return fallback for empty result', () => {
      expect(sanitizeFilename('../../')).toBe('attachment')
      expect(sanitizeFilename('...')).toBe('attachment')
    })
  })
})
