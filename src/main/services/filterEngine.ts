import type { Task, Label } from '@shared/types'
import { startOfDay, endOfDay, addDays } from '@shared/utils'

/**
 * Filter Engine - parses and evaluates Todoist-like filter queries
 *
 * Supported query syntax:
 * - today, tomorrow, overdue
 * - p1, p2, p3, p4 (priority)
 * - #project_name (project)
 * - @label_name (label - requires labels on task)
 * - due before: DATE, due after: DATE
 * - no date, has:date
 * - recurring, !recurring
 * - assigned, unassigned
 * - has:description, has:labels
 * - search:text (explicit text search)
 * - ! (negation prefix)
 * - & (AND), | (OR)
 * - (parentheses for grouping)
 */

interface FilterContext {
  projects: Map<string, string> // name -> id
  labels: Map<string, string> // name -> id
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

  // has: prefix queries
  if (c === 'has:date') {
    return task.dueDate !== null
  }
  if (c === 'has:description') {
    return task.description !== null && task.description !== ''
  }
  if (c === 'has:labels') {
    return task.labels !== undefined && task.labels.length > 0
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

  // Project (#name)
  if (c.startsWith('#')) {
    const projectName = c.slice(1).trim()
    const projectId = context.projects.get(projectName)
    if (projectId) {
      return task.projectId === projectId
    }
    // Also try matching against raw project ID
    return task.projectId === projectName
  }

  // Label (@name) - check task.labels array if populated
  if (c.startsWith('@')) {
    const labelName = c.slice(1).trim()
    // Check if task has labels populated (from join)
    if (!task.labels || task.labels.length === 0) {
      // Try matching against context's label map
      const labelId = context.labels.get(labelName)
      return false // Without labels data on task, can't match
    }
    return task.labels.some((l: Label) => l.name.toLowerCase() === labelName)
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
  labels: { id: string; name: string }[]
): FilterContext {
  const projectMap = new Map<string, string>()
  const labelMap = new Map<string, string>()

  for (const p of projects) {
    projectMap.set(p.name.toLowerCase(), p.id)
  }

  for (const l of labels) {
    labelMap.set(l.name.toLowerCase(), l.id)
  }

  return { projects: projectMap, labels: labelMap }
}
