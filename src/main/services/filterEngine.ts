import type { Task } from '@shared/types'
import { startOfDay, endOfDay, addDays } from '@shared/utils'

/**
 * Filter Engine - parses and evaluates Todoist-like filter queries
 *
 * Supported query syntax:
 * - today, tomorrow, overdue
 * - p1, p2, p3, p4 (priority)
 * - #project_name
 * - @label_name
 * - due before: DATE, due after: DATE
 * - no date
 * - & (AND), | (OR)
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
  // Handle OR (|)
  if (query.includes('|')) {
    const parts = query.split('|').map((p) => p.trim())
    return parts.some((part) => evaluateExpression(task, part, context))
  }

  // Handle AND (&)
  if (query.includes('&')) {
    const parts = query.split('&').map((p) => p.trim())
    return parts.every((part) => evaluateExpression(task, part, context))
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

  // Label (@name) - Note: We'd need to check task_labels table for this
  // For now, we'll skip this since we'd need to pass label data
  if (c.startsWith('@')) {
    // This would require having labels data on the task
    // For now, return false (would need refactoring)
    return false
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
