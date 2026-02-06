/**
 * Date formatting utilities that respect user settings.
 */

type DateFormat = 'mdy' | 'dmy' | 'ymd'
type TimeFormat = '12h' | '24h'

/**
 * Format a date according to the user's dateFormat setting.
 * Returns a short date string like "Feb 6, 2026" / "6 Feb 2026" / "2026 Feb 6"
 */
export function formatDateByPreference(date: Date, dateFormat: DateFormat): string {
  const month = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()
  const year = date.getFullYear()

  switch (dateFormat) {
    case 'dmy':
      return `${day} ${month} ${year}`
    case 'ymd':
      return `${year} ${month} ${day}`
    case 'mdy':
    default:
      return `${month} ${day}, ${year}`
  }
}

/**
 * Format a date for display headers (includes weekday).
 * E.g., "Monday, Feb 6, 2026" / "Monday, 6 Feb 2026"
 */
export function formatDateHeader(date: Date, dateFormat: DateFormat): string {
  const weekday = date.toLocaleString('en-US', { weekday: 'long' })
  const month = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()

  switch (dateFormat) {
    case 'dmy':
      return `${weekday}, ${day} ${month}`
    case 'ymd':
      return `${weekday}, ${month} ${day}`
    case 'mdy':
    default:
      return `${weekday}, ${month} ${day}`
  }
}

/**
 * Format a short date for group labels (includes short weekday).
 * E.g., "Mon, Feb 6" / "Mon, 6 Feb"
 */
export function formatDateGroupLabel(date: Date, dateFormat: DateFormat): string {
  const weekday = date.toLocaleString('en-US', { weekday: 'short' })
  const month = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()

  switch (dateFormat) {
    case 'dmy':
      return `${weekday}, ${day} ${month}`
    case 'ymd':
      return `${weekday}, ${month} ${day}`
    case 'mdy':
    default:
      return `${weekday}, ${month} ${day}`
  }
}

/**
 * Format a time according to the user's timeFormat setting.
 */
export function formatTime(date: Date, timeFormat: TimeFormat): string {
  const hours = date.getHours()
  const mins = String(date.getMinutes()).padStart(2, '0')
  if (timeFormat === '24h') {
    return `${String(hours).padStart(2, '0')}:${mins}`
  }
  const h12 = hours % 12 || 12
  const ampm = hours < 12 ? 'AM' : 'PM'
  return `${h12}:${mins} ${ampm}`
}
