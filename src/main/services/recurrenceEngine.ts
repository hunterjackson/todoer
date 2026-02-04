import { RRule, rrulestr } from 'rrule'

export interface RecurrenceInfo {
  rule: string
  description: string
  nextOccurrence: number | null
}

// Parse RRULE string and get info
export function getRecurrenceInfo(rruleString: string, fromDate?: Date): RecurrenceInfo {
  try {
    const rule = rrulestr(rruleString)
    const description = rule.toText()
    const next = rule.after(fromDate || new Date())

    return {
      rule: rruleString,
      description,
      nextOccurrence: next ? next.getTime() : null
    }
  } catch {
    return {
      rule: rruleString,
      description: 'Invalid recurrence rule',
      nextOccurrence: null
    }
  }
}

// Get the next occurrence after a given date
export function getNextOccurrence(rruleString: string, afterDate?: Date): number | null {
  try {
    const rule = rrulestr(rruleString)
    const next = rule.after(afterDate || new Date())
    return next ? next.getTime() : null
  } catch {
    return null
  }
}

// Get multiple future occurrences
export function getOccurrences(rruleString: string, count: number = 10, afterDate?: Date): number[] {
  try {
    const rule = rrulestr(rruleString)
    const start = afterDate || new Date()

    // Use rrule's built-in method to get occurrences after the start date
    const occurrences: Date[] = []
    let current = start

    while (occurrences.length < count) {
      const next = rule.after(current)
      if (!next) break
      occurrences.push(next)
      // Move current forward by 1ms to ensure we get the next distinct occurrence
      current = new Date(next.getTime() + 1)
    }

    return occurrences.map((d) => d.getTime())
  } catch {
    return []
  }
}

// Create an RRULE string from options
export interface RecurrenceOptions {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  byWeekDay?: number[] // 0 = Monday, 6 = Sunday (RRule convention)
  byMonthDay?: number[]
  byMonth?: number[]
  count?: number
  until?: Date
}

export function createRRule(options: RecurrenceOptions): string {
  const freq = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY
  }[options.frequency]

  const ruleOptions: Partial<ConstructorParameters<typeof RRule>[0]> = {
    freq,
    interval: options.interval || 1
  }

  if (options.byWeekDay && options.byWeekDay.length > 0) {
    const weekDays = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]
    ruleOptions.byweekday = options.byWeekDay.map((d) => weekDays[d])
  }

  if (options.byMonthDay && options.byMonthDay.length > 0) {
    ruleOptions.bymonthday = options.byMonthDay
  }

  if (options.byMonth && options.byMonth.length > 0) {
    ruleOptions.bymonth = options.byMonth
  }

  if (options.count) {
    ruleOptions.count = options.count
  }

  if (options.until) {
    ruleOptions.until = options.until
  }

  const rule = new RRule(ruleOptions as ConstructorParameters<typeof RRule>[0])
  return rule.toString()
}

// Human-readable description of recurrence
export function describeRecurrence(rruleString: string): string {
  try {
    const rule = rrulestr(rruleString)
    return rule.toText()
  } catch {
    return 'Custom recurrence'
  }
}

// Check if a date matches a recurrence pattern
export function matchesRecurrence(rruleString: string, date: Date): boolean {
  try {
    // Parse the rule
    const rule = rrulestr(rruleString)
    const options = rule.options

    // Check frequency-based matching
    const dayOfWeek = date.getUTCDay() // 0 = Sunday, 6 = Saturday

    // For BYDAY rules, check if the day matches
    if (options.byweekday && options.byweekday.length > 0) {
      // RRule uses 0=Monday, so we need to convert JS day (0=Sunday)
      // JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      // RRule: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
      const rruleDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const matchesDay = options.byweekday.some((wd: number | { weekday: number }) => {
        const weekday = typeof wd === 'number' ? wd : wd.weekday
        return weekday === rruleDay
      })
      if (!matchesDay) return false
    }

    // For DAILY frequency without constraints, any day matches
    if (options.freq === RRule.DAILY && !options.byweekday) {
      return true
    }

    // For weekly/monthly/yearly, we'd need more sophisticated matching
    // For now, just check if it's a valid pattern day
    if (options.freq === RRule.WEEKLY && options.byweekday && options.byweekday.length > 0) {
      return true // Already checked above
    }

    // For DAILY with the date in the pattern
    if (options.freq === RRule.DAILY) {
      return true
    }

    // Default to checking with between
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const occurrences = rule.between(startOfDay, endOfDay, true)
    return occurrences.length > 0
  } catch {
    return false
  }
}

// Calculate the next due date after completing a recurring task
export function calculateNextDueDate(
  rruleString: string,
  currentDueDate: number,
  completedAt: number
): number | null {
  try {
    // Create a new rule with DTSTART set to the current due date
    const baseRule = rrulestr(rruleString)
    const options = baseRule.options

    // Create new rule with the current due date as start
    const rule = new RRule({
      ...options,
      dtstart: new Date(currentDueDate)
    })

    // Get the next occurrence after the reference point
    const referenceDate = new Date(Math.max(currentDueDate, completedAt))
    const next = rule.after(referenceDate)

    return next ? next.getTime() : null
  } catch {
    return null
  }
}
