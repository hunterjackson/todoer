// Generate unique ID (simple implementation that doesn't require nanoid)
export function generateId(): string {
  // Use crypto.randomUUID if available (modern Node/browser)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 21)
  }
  // Fallback: timestamp + random chars
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return timestamp + randomPart
}

// Get current timestamp in milliseconds
export function now(): number {
  return Date.now()
}

// Get start of day timestamp
export function startOfDay(date: Date | number = Date.now()): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Get end of day timestamp
export function endOfDay(date: Date | number = Date.now()): number {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

// Add days to a timestamp
export function addDays(date: Date | number, days: number): number {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

// Format date for display
export function formatDate(timestamp: number, format: string = 'MMM d'): string {
  const date = new Date(timestamp)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return format
    .replace('MMM', months[date.getMonth()])
    .replace('MMMM', months[date.getMonth()])
    .replace('ddd', days[date.getDay()])
    .replace('dd', date.getDate().toString().padStart(2, '0'))
    .replace('d', date.getDate().toString())
    .replace('yyyy', date.getFullYear().toString())
    .replace('yy', date.getFullYear().toString().slice(-2))
    .replace('HH', date.getHours().toString().padStart(2, '0'))
    .replace('mm', date.getMinutes().toString().padStart(2, '0'))
}

/**
 * Get a consistent local date key in YYYY-MM-DD format
 * Uses local timezone, not UTC, for consistent streak/history tracking
 */
export function getLocalDateKey(date: Date | number = Date.now()): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Check if a date is today
export function isToday(timestamp: number): boolean {
  const today = startOfDay()
  const date = startOfDay(timestamp)
  return date === today
}

// Check if a date is tomorrow
export function isTomorrow(timestamp: number): boolean {
  const tomorrow = startOfDay(addDays(Date.now(), 1))
  const date = startOfDay(timestamp)
  return date === tomorrow
}

// Check if a date is overdue
export function isOverdue(timestamp: number): boolean {
  return timestamp < startOfDay()
}

// Check if a date is within the next N days
export function isWithinDays(timestamp: number, days: number): boolean {
  const start = startOfDay()
  const end = endOfDay(addDays(Date.now(), days - 1))
  return timestamp >= start && timestamp <= end
}

// Calculate fractional index for reordering
export function calculateSortOrder(before: number | null, after: number | null): number {
  if (before === null && after === null) {
    return 1
  }
  if (before === null) {
    return after! / 2
  }
  if (after === null) {
    return before + 1
  }
  return (before + after) / 2
}

// Deep clone an object
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

// Throttle function
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// Group array by key
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key])
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
      return result
    },
    {} as Record<string, T[]>
  )
}

// Sort array by multiple keys
export function sortBy<T>(array: T[], ...keys: (keyof T | ((item: T) => unknown))[]): T[] {
  return [...array].sort((a, b) => {
    for (const key of keys) {
      const aVal = typeof key === 'function' ? key(a) : a[key]
      const bVal = typeof key === 'function' ? key(b) : b[key]

      if ((aVal as string | number) < (bVal as string | number)) return -1
      if ((aVal as string | number) > (bVal as string | number)) return 1
    }
    return 0
  })
}

// Escape HTML for safe rendering
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// Re-export inline task parser utilities
export {
  parseInlineTaskContent,
  findProjectByName,
  findSectionByName
} from './inlineTaskParser'
export type { ParsedTaskContent } from './inlineTaskParser'
