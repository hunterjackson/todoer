import type { Task, TaskLabel } from '@shared/types'
import { startOfDay, endOfDay, addDays } from '@shared/utils'

/**
 * Filter Engine - parses and evaluates Todoist-like filter queries
 *
 * Supported query syntax:
 * - today, tomorrow, overdue
 * - p1, p2, p3, p4 (priority)
 * - #project_name (project, supports * wildcard)
 * - @label_name (label - requires labels on task, supports * wildcard)
 * - /section_name (section, supports * wildcard)
 * - due before: DATE, due after: DATE
 * - deadline:today, deadline:tomorrow, deadline:overdue
 * - deadline before: DATE, deadline after: DATE
 * - no date, has:date
 * - no deadline, has:deadline
 * - recurring, !recurring
 * - assigned, unassigned
 * - delegated:name (tasks delegated to specific person)
 * - delegated (any delegated task)
 * - !delegated (tasks without delegation)
 * - has:description, has:labels, has:duration
 * - search:text (explicit text search)
 * - ! (negation prefix)
 * - & (AND), | (OR)
 * - (parentheses for grouping)
 */

interface FilterContext {
  projects: Map<string, string[]> // name -> ids (supports duplicate names)
  labels: Map<string, string[]> // name -> ids (supports duplicate names)
  sections: Map<string, string[]> // name -> ids (supports duplicate names)
}

export function evaluateFilter(
  tasks: Task[],
  query: string,
  context: FilterContext
): Task[] {
  const normalizedQuery = query.toLowerCase().trim()

  if (!normalizedQuery) {
    return tasks
  }

  // Parse and evaluate the query
  return tasks.filter((task) => evaluateExpression(task, normalizedQuery, context))
}

function evaluateExpression(task: Task, query: string, context: FilterContext): boolean {
  // Handle parentheses - find innermost parentheses and evaluate
  let currentQuery = query
  while (currentQuery.includes('(')) {
    const parenMatch = currentQuery.match(/\(([^()]+)\)/)
    if (!parenMatch) break
    const inner = parenMatch[1]
    const result = evaluateExpressionWithoutParens(task, inner, context)
    currentQuery = currentQuery.replace(`(${inner})`, result ? 'TRUE' : 'FALSE')
  }

  return evaluateExpressionWithoutParens(task, currentQuery, context)
}

function evaluateExpressionWithoutParens(task: Task, query: string, context: FilterContext): boolean {
  // Handle TRUE/FALSE placeholders from parentheses evaluation
  if (query.toLowerCase() === 'true') return true
  if (query.toLowerCase() === 'false') return false

  // Handle OR (|)
  if (query.includes('|')) {
    const parts = query.split('|').map((p) => p.trim())
    return parts.some((part) => evaluateExpressionWithoutParens(task, part, context))
  }

  // Handle AND (&)
  if (query.includes('&')) {
    const parts = query.split('&').map((p) => p.trim())
    return parts.every((part) => evaluateExpressionWithoutParens(task, part, context))
  }

  // Handle negation (!)
  if (query.startsWith('!') && query.length > 1) {
    return !evaluateCondition(task, query.slice(1), context)
  }

  // Handle individual conditions
  return evaluateCondition(task, query, context)
}

function evaluateCondition(task: Task, condition: string, context: FilterContext): boolean {
  const c = condition.toLowerCase().trim()

  // Skip completed and deleted tasks by default
  if (task.completed || task.deletedAt) {
    return false
  }

  // Recurring filter
  if (c === 'recurring') {
    return task.recurrenceRule !== null && task.recurrenceRule !== ''
  }

  // Assigned/unassigned filter
  if (c === 'assigned') {
    return task.projectId !== null
  }
  if (c === 'unassigned') {
    return task.projectId === null
  }

  // Delegated filter
  if (c === 'delegated') {
    return task.delegatedTo !== null && task.delegatedTo !== ''
  }
  if (c.startsWith('delegated:')) {
    const name = c.slice(10).trim()
    if (name === '*') {
      return task.delegatedTo !== null && task.delegatedTo !== ''
    }
    return task.delegatedTo?.toLowerCase() === name
  }

  // has: prefix queries
  if (c === 'has:date') {
    return task.dueDate !== null
  }
  if (c === 'has:deadline') {
    return task.deadline !== null
  }
  if (c === 'has:description') {
    return task.description !== null && task.description !== ''
  }
  if (c === 'has:labels') {
    return task.labels !== undefined && task.labels.length > 0
  }
  if (c === 'has:duration') {
    return task.duration !== null && task.duration > 0
  }

  // Explicit search (search:text)
  if (c.startsWith('search:')) {
    const searchTerm = c.slice(7).trim()
    const inContent = task.content.toLowerCase().includes(searchTerm)
    const inDescription = task.description?.toLowerCase().includes(searchTerm) || false
    return inContent || inDescription
  }

  // Date-based conditions
  if (c === 'today') {
    if (!task.dueDate) return false
    const todayStart = startOfDay()
    const todayEnd = endOfDay()
    return task.dueDate >= todayStart && task.dueDate <= todayEnd
  }

  if (c === 'tomorrow') {
    if (!task.dueDate) return false
    const tomorrowStart = startOfDay(addDays(Date.now(), 1))
    const tomorrowEnd = endOfDay(addDays(Date.now(), 1))
    return task.dueDate >= tomorrowStart && task.dueDate <= tomorrowEnd
  }

  if (c === 'overdue') {
    if (!task.dueDate) return false
    return task.dueDate < startOfDay()
  }

  if (c === 'no date' || c === 'no due date') {
    return task.dueDate === null
  }

  if (c === 'no deadline') {
    return task.deadline === null
  }

  // Deadline-based conditions
  if (c === 'deadline:today') {
    if (!task.deadline) return false
    const todayStart = startOfDay()
    const todayEnd = endOfDay()
    return task.deadline >= todayStart && task.deadline <= todayEnd
  }

  if (c === 'deadline:tomorrow') {
    if (!task.deadline) return false
    const tomorrowStart = startOfDay(addDays(Date.now(), 1))
    const tomorrowEnd = endOfDay(addDays(Date.now(), 1))
    return task.deadline >= tomorrowStart && task.deadline <= tomorrowEnd
  }

  if (c === 'deadline:overdue') {
    if (!task.deadline) return false
    return task.deadline < startOfDay()
  }

  // "deadline before: DATE" or "deadline after: DATE"
  if (c.startsWith('deadline before:')) {
    if (!task.deadline) return false
    const dateStr = c.slice(16).trim()
    const targetDate = parseDateString(dateStr)
    if (targetDate) {
      return task.deadline < targetDate
    }
  }

  if (c.startsWith('deadline after:')) {
    if (!task.deadline) return false
    const dateStr = c.slice(15).trim()
    const targetDate = parseDateString(dateStr)
    if (targetDate) {
      return task.deadline > targetDate
    }
  }

  // "next 7 days" or "7 days"
  const daysMatch = c.match(/^(?:next\s+)?(\d+)\s*days?$/)
  if (daysMatch) {
    if (!task.dueDate) return false
    const days = parseInt(daysMatch[1], 10)
    const todayStart = startOfDay()
    const futureEnd = endOfDay(addDays(Date.now(), days))
    return task.dueDate >= todayStart && task.dueDate <= futureEnd
  }

  // Priority (p1, p2, p3, p4)
  const priorityMatch = c.match(/^p([1-4])$/)
  if (priorityMatch) {
    return task.priority === parseInt(priorityMatch[1], 10)
  }

  // Project (#name) - supports wildcard (*)
  if (c.startsWith('#')) {
    const projectName = c.slice(1).trim()
    const hasWildcard = projectName.includes('*')

    if (hasWildcard) {
      // Find any matching project using wildcard pattern
      for (const [name, ids] of context.projects) {
        if (matchWildcard(projectName, name) && ids.includes(task.projectId ?? '')) {
          return true
        }
      }
      return false
    }

    const projectIds = context.projects.get(projectName)
    if (projectIds) {
      return projectIds.includes(task.projectId ?? '')
    }
    // Also try matching against raw project ID
    return task.projectId === projectName
  }

  // Label (@name) - check task.labels array if populated, supports wildcard (*)
  if (c.startsWith('@')) {
    const labelName = c.slice(1).trim()
    const hasWildcard = labelName.includes('*')

    // Check if task has labels populated (from join)
    if (!task.labels || task.labels.length === 0) {
      return false
    }

    if (hasWildcard) {
      return task.labels.some((l: TaskLabel) => matchWildcard(labelName, l.name.toLowerCase()))
    }

    return task.labels.some((l: TaskLabel) => l.name.toLowerCase() === labelName)
  }

  // Section (/name) - supports wildcard (*)
  if (c.startsWith('/')) {
    const sectionName = c.slice(1).trim()
    const hasWildcard = sectionName.includes('*')

    if (hasWildcard) {
      // Find any matching section using wildcard pattern
      for (const [name, ids] of context.sections) {
        if (matchWildcard(sectionName, name) && ids.includes(task.sectionId ?? '')) {
          return true
        }
      }
      return false
    }

    const sectionIds = context.sections.get(sectionName)
    if (sectionIds) {
      return sectionIds.includes(task.sectionId ?? '')
    }
    // Also try matching against raw section ID
    return task.sectionId === sectionName
  }

  // "due before: DATE" or "due after: DATE"
  if (c.startsWith('due before:')) {
    if (!task.dueDate) return false
    const dateStr = c.slice(11).trim()
    const targetDate = parseDateString(dateStr)
    if (targetDate) {
      return task.dueDate < targetDate
    }
  }

  if (c.startsWith('due after:')) {
    if (!task.dueDate) return false
    const dateStr = c.slice(10).trim()
    const targetDate = parseDateString(dateStr)
    if (targetDate) {
      return task.dueDate > targetDate
    }
  }

  // Search in content
  if (task.content.toLowerCase().includes(c)) {
    return true
  }

  // Search in description
  if (task.description?.toLowerCase().includes(c)) {
    return true
  }

  return false
}

/**
 * Match a pattern with wildcards (*) against a string.
 * * matches any sequence of characters (including empty).
 */
function matchWildcard(pattern: string, str: string): boolean {
  // Convert wildcard pattern to regex
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  // Replace * with .* for regex matching
  const regexPattern = escaped.replace(/\*/g, '.*')
  const regex = new RegExp(`^${regexPattern}$`, 'i')
  return regex.test(str)
}

function parseDateString(str: string): number | null {
  const s = str.toLowerCase().trim()

  if (s === 'today') {
    return startOfDay()
  }

  if (s === 'tomorrow') {
    return startOfDay(addDays(Date.now(), 1))
  }

  // Try parsing as a date
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    return date.getTime()
  }

  return null
}

export function createFilterContext(
  projects: { id: string; name: string }[],
  labels: { id: string; name: string }[],
  sections: { id: string; name: string }[] = []
): FilterContext {
  const projectMap = new Map<string, string[]>()
  const labelMap = new Map<string, string[]>()
  const sectionMap = new Map<string, string[]>()

  for (const p of projects) {
    const key = p.name.toLowerCase()
    const existing = projectMap.get(key) || []
    existing.push(p.id)
    projectMap.set(key, existing)
  }

  for (const l of labels) {
    const key = l.name.toLowerCase()
    const existing = labelMap.get(key) || []
    existing.push(l.id)
    labelMap.set(key, existing)
  }

  for (const s of sections) {
    const key = s.name.toLowerCase()
    const existing = sectionMap.get(key) || []
    existing.push(s.id)
    sectionMap.set(key, existing)
  }

  return { projects: projectMap, labels: labelMap, sections: sectionMap }
}
