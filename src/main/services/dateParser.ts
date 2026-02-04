import * as chrono from 'chrono-node'

export interface ParsedDate {
  timestamp: number
  hasTime: boolean
  text: string
}

// Create a custom chrono parser for Todoist-like date parsing
const customChrono = chrono.casual.clone()

// Parse natural language date string
export function parseDate(text: string, referenceDate?: Date): ParsedDate | null {
  if (!text || text.trim() === '') {
    return null
  }

  const ref = referenceDate || new Date()
  const results = customChrono.parse(text, ref, { forwardDate: true })

  if (results.length === 0) {
    return null
  }

  const result = results[0]
  const parsedDate = result.start.date()

  // Check if time was explicitly specified
  const hasTime = result.start.isCertain('hour') || result.start.isCertain('minute')

  // If no time specified, set to end of day for due dates
  if (!hasTime) {
    parsedDate.setHours(23, 59, 59, 999)
  }

  return {
    timestamp: parsedDate.getTime(),
    hasTime,
    text: result.text
  }
}

// Parse recurring date patterns (returns RRULE string)
export function parseRecurrence(text: string): string | null {
  const lowerText = text.toLowerCase().trim()

  // Common patterns
  const patterns: Record<string, string> = {
    'every day': 'FREQ=DAILY',
    'daily': 'FREQ=DAILY',
    'every weekday': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    'every weekend': 'FREQ=WEEKLY;BYDAY=SA,SU',
    'every week': 'FREQ=WEEKLY',
    'weekly': 'FREQ=WEEKLY',
    'every month': 'FREQ=MONTHLY',
    'monthly': 'FREQ=MONTHLY',
    'every year': 'FREQ=YEARLY',
    'yearly': 'FREQ=YEARLY',
    'annually': 'FREQ=YEARLY',
  }

  // Check for simple patterns
  if (patterns[lowerText]) {
    return patterns[lowerText]
  }

  // Match "every N days/weeks/months/years"
  const everyNMatch = lowerText.match(/every (\d+) (day|week|month|year)s?/)
  if (everyNMatch) {
    const interval = parseInt(everyNMatch[1])
    const unit = everyNMatch[2].toUpperCase()
    const freq = unit === 'DAY' ? 'DAILY' : unit === 'WEEK' ? 'WEEKLY' : unit === 'MONTH' ? 'MONTHLY' : 'YEARLY'
    return `FREQ=${freq};INTERVAL=${interval}`
  }

  // Match "every monday/tuesday/etc"
  const dayNames: Record<string, string> = {
    'sunday': 'SU', 'sun': 'SU',
    'monday': 'MO', 'mon': 'MO',
    'tuesday': 'TU', 'tue': 'TU',
    'wednesday': 'WE', 'wed': 'WE',
    'thursday': 'TH', 'thu': 'TH',
    'friday': 'FR', 'fri': 'FR',
    'saturday': 'SA', 'sat': 'SA',
  }

  const everyDayMatch = lowerText.match(/every (sunday|sun|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat)/)
  if (everyDayMatch) {
    const day = dayNames[everyDayMatch[1]]
    if (day) {
      return `FREQ=WEEKLY;BYDAY=${day}`
    }
  }

  // Match "every monday and wednesday" etc
  const multipleDaysMatch = lowerText.match(/every (.+)/)
  if (multipleDaysMatch) {
    const daysText = multipleDaysMatch[1]
    const days: string[] = []

    for (const [name, abbrev] of Object.entries(dayNames)) {
      if (daysText.includes(name)) {
        days.push(abbrev)
      }
    }

    if (days.length > 0) {
      // Remove duplicates
      const uniqueDays = [...new Set(days)]
      return `FREQ=WEEKLY;BYDAY=${uniqueDays.join(',')}`
    }
  }

  // Match "on the Nth of every month"
  const nthOfMonthMatch = lowerText.match(/(?:on the )?(\d+)(?:st|nd|rd|th)? (?:of )?every month/)
  if (nthOfMonthMatch) {
    const day = parseInt(nthOfMonthMatch[1])
    return `FREQ=MONTHLY;BYMONTHDAY=${day}`
  }

  // Match "on the last day of every month"
  if (lowerText.includes('last day') && lowerText.includes('month')) {
    return 'FREQ=MONTHLY;BYMONTHDAY=-1'
  }

  return null
}

// Combine date and recurrence parsing
export function parseDateWithRecurrence(text: string, referenceDate?: Date): {
  date: ParsedDate | null
  recurrence: string | null
} {
  // Check for recurrence first
  const recurrence = parseRecurrence(text)

  // Remove recurrence part to parse the date
  let dateText = text
  if (recurrence) {
    // Try to extract date part if present
    dateText = text
      .replace(/every (day|week|month|year|weekday|weekend)/gi, '')
      .replace(/every \d+ (day|week|month|year)s?/gi, '')
      .replace(/every (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/gi, '')
      .replace(/daily|weekly|monthly|yearly|annually/gi, '')
      .trim()
  }

  const date = dateText ? parseDate(dateText, referenceDate) : null

  return { date, recurrence }
}

// Format a timestamp for display
export function formatDateForDisplay(timestamp: number, includeTime: boolean = false): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  let dateStr: string

  if (dateOnly.getTime() === today.getTime()) {
    dateStr = 'Today'
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    dateStr = 'Tomorrow'
  } else if (dateOnly.getTime() < today.getTime()) {
    // Overdue - show full date
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    dateStr = `${months[date.getMonth()]} ${date.getDate()}`
    if (date.getFullYear() !== now.getFullYear()) {
      dateStr += ` ${date.getFullYear()}`
    }
  } else {
    // Future date
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // If within the next week, show day name
    const weekFromNow = new Date(today)
    weekFromNow.setDate(weekFromNow.getDate() + 7)

    if (dateOnly < weekFromNow) {
      dateStr = days[date.getDay()]
    } else {
      dateStr = `${months[date.getMonth()]} ${date.getDate()}`
      if (date.getFullYear() !== now.getFullYear()) {
        dateStr += ` ${date.getFullYear()}`
      }
    }
  }

  if (includeTime) {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    if (hours !== 23 || minutes !== 59) {
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const hour12 = hours % 12 || 12
      const minStr = minutes.toString().padStart(2, '0')
      dateStr += ` ${hour12}:${minStr} ${ampm}`
    }
  }

  return dateStr
}
