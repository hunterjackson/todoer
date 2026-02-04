import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'

// Extended filter engine tests
describe('Enhanced Filter Engine', () => {
  let db: Database
  let tasks: TestTask[]
  let context: TestFilterContext

  interface TestTask {
    id: string
    content: string
    description: string | null
    projectId: string | null
    sectionId?: string | null
    dueDate: number | null
    deadline?: number | null
    duration?: number | null
    priority: number
    completed: boolean
    deletedAt: number | null
    recurrenceRule: string | null
    createdAt: number
    labels?: { id: string; name: string }[]
  }

  interface TestFilterContext {
    projects: Map<string, string>
    labels: Map<string, string>
    sections?: Map<string, string>
  }

  beforeEach(() => {
    const now = Date.now()
    const yesterday = now - 86400000
    const tomorrow = now + 86400000
    const lastWeek = now - 7 * 86400000

    context = {
      projects: new Map([
        ['work', 'proj-1'],
        ['personal', 'proj-2'],
        ['shopping', 'proj-3'],
        ['work-admin', 'proj-4']
      ]),
      labels: new Map([
        ['urgent', 'label-1'],
        ['home', 'label-2'],
        ['waiting', 'label-3'],
        ['urgent-blocker', 'label-4']
      ]),
      sections: new Map([
        ['to do', 'sec-1'],
        ['in progress', 'sec-2'],
        ['done', 'sec-3']
      ])
    }

    tasks = [
      {
        id: '1',
        content: 'Work meeting',
        description: 'Discuss project timeline',
        projectId: 'proj-1',
        sectionId: 'sec-1',
        dueDate: now,
        deadline: tomorrow,
        duration: 60,
        priority: 1,
        completed: false,
        deletedAt: null,
        recurrenceRule: 'FREQ=WEEKLY',
        createdAt: lastWeek,
        labels: [{ id: 'label-1', name: 'urgent' }]
      },
      {
        id: '2',
        content: 'Buy groceries',
        description: null,
        projectId: 'proj-2',
        sectionId: null,
        dueDate: tomorrow,
        deadline: null,
        duration: null,
        priority: 3,
        completed: false,
        deletedAt: null,
        recurrenceRule: null,
        createdAt: yesterday,
        labels: [{ id: 'label-2', name: 'home' }]
      },
      {
        id: '3',
        content: 'Review documents',
        description: 'Important review needed',
        projectId: 'proj-1',
        sectionId: 'sec-2',
        dueDate: null,
        deadline: yesterday,
        duration: 30,
        priority: 2,
        completed: false,
        deletedAt: null,
        recurrenceRule: null,
        createdAt: now,
        labels: []
      },
      {
        id: '4',
        content: 'Call mom',
        description: null,
        projectId: null,
        sectionId: null,
        dueDate: yesterday,
        deadline: now,
        duration: null,
        priority: 4,
        completed: false,
        deletedAt: null,
        recurrenceRule: null,
        createdAt: lastWeek,
        labels: [{ id: 'label-2', name: 'home' }, { id: 'label-3', name: 'waiting' }]
      },
      {
        id: '5',
        content: 'Completed task',
        description: null,
        projectId: 'proj-1',
        sectionId: null,
        dueDate: now,
        deadline: null,
        duration: null,
        priority: 1,
        completed: true,
        deletedAt: null,
        recurrenceRule: null,
        createdAt: lastWeek,
        labels: []
      },
      {
        id: '6',
        content: 'Admin task',
        description: null,
        projectId: 'proj-4',
        sectionId: null,
        dueDate: now,
        deadline: null,
        duration: 45,
        priority: 2,
        completed: false,
        deletedAt: null,
        recurrenceRule: null,
        createdAt: now,
        labels: [{ id: 'label-4', name: 'urgent-blocker' }]
      }
    ]
  })

  describe('Label filtering (@syntax)', () => {
    it('should filter by label name', () => {
      const result = evaluateFilter(tasks, '@urgent', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Work meeting')
    })

    it('should filter by multiple labels with OR', () => {
      const result = evaluateFilter(tasks, '@urgent | @home', context)
      expect(result).toHaveLength(3)
    })

    it('should filter by label with AND (task must have both)', () => {
      const result = evaluateFilter(tasks, '@home & @waiting', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Call mom')
    })
  })

  describe('Recurring task filtering', () => {
    it('should filter recurring tasks', () => {
      const result = evaluateFilter(tasks, 'recurring', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Work meeting')
    })

    it('should filter non-recurring tasks', () => {
      const result = evaluateFilter(tasks, '!recurring', context)
      expect(result.length).toBeGreaterThan(0)
      expect(result.every(t => !t.recurrenceRule)).toBe(true)
    })
  })

  describe('Assigned/unassigned filtering', () => {
    it('should filter tasks assigned to a project', () => {
      const result = evaluateFilter(tasks, 'assigned', context)
      expect(result.every(t => t.projectId !== null)).toBe(true)
    })

    it('should filter tasks not assigned to a project', () => {
      const result = evaluateFilter(tasks, 'unassigned', context)
      expect(result.every(t => t.projectId === null)).toBe(true)
    })
  })

  describe('Negation (!)', () => {
    it('should negate priority', () => {
      const result = evaluateFilter(tasks, '!p1', context)
      expect(result.every(t => t.priority !== 1)).toBe(true)
    })

    it('should negate project filter', () => {
      const result = evaluateFilter(tasks, '!#work', context)
      expect(result.every(t => t.projectId !== 'proj-1')).toBe(true)
    })
  })

  describe('Text search (search:)', () => {
    it('should search in content', () => {
      const result = evaluateFilter(tasks, 'search:meeting', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Work meeting')
    })

    it('should search in description', () => {
      const result = evaluateFilter(tasks, 'search:timeline', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Work meeting')
    })

    it('should be case insensitive', () => {
      const result = evaluateFilter(tasks, 'search:MEETING', context)
      expect(result).toHaveLength(1)
    })
  })

  describe('Combined complex queries', () => {
    it('should handle p1 & #work', () => {
      const result = evaluateFilter(tasks, 'p1 & #work', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Work meeting')
    })

    it('should handle (p1 | p2) & #work', () => {
      const result = evaluateFilter(tasks, '(p1 | p2) & #work', context)
      expect(result).toHaveLength(2)
    })

    it('should handle @urgent | overdue', () => {
      const result = evaluateFilter(tasks, '@urgent | overdue', context)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle !no date & #work', () => {
      const result = evaluateFilter(tasks, '!no date & #work', context)
      expect(result.every(t => t.dueDate !== null && t.projectId === 'proj-1')).toBe(true)
    })
  })

  describe('has: prefix queries', () => {
    it('should filter tasks with due date using has:date', () => {
      const result = evaluateFilter(tasks, 'has:date', context)
      expect(result.every(t => t.dueDate !== null)).toBe(true)
    })

    it('should filter tasks with description using has:description', () => {
      const result = evaluateFilter(tasks, 'has:description', context)
      expect(result.every(t => t.description !== null && t.description !== '')).toBe(true)
    })

    it('should filter tasks with labels using has:labels', () => {
      const result = evaluateFilter(tasks, 'has:labels', context)
      expect(result.every(t => t.labels && t.labels.length > 0)).toBe(true)
    })

    it('should filter tasks with deadline using has:deadline', () => {
      const result = evaluateFilter(tasks, 'has:deadline', context)
      expect(result.every(t => t.deadline !== null)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should filter tasks with duration using has:duration', () => {
      const result = evaluateFilter(tasks, 'has:duration', context)
      expect(result.every(t => t.duration !== null && t.duration > 0)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Deadline filtering', () => {
    it('should filter tasks with deadline today using deadline:today', () => {
      const result = evaluateFilter(tasks, 'deadline:today', context)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some(t => t.content === 'Call mom')).toBe(true)
    })

    it('should filter tasks with deadline tomorrow using deadline:tomorrow', () => {
      const result = evaluateFilter(tasks, 'deadline:tomorrow', context)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some(t => t.content === 'Work meeting')).toBe(true)
    })

    it('should filter tasks with overdue deadline using deadline:overdue', () => {
      const result = evaluateFilter(tasks, 'deadline:overdue', context)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some(t => t.content === 'Review documents')).toBe(true)
    })

    it('should filter tasks with no deadline using no deadline', () => {
      const result = evaluateFilter(tasks, 'no deadline', context)
      expect(result.every(t => t.deadline === null)).toBe(true)
    })
  })

  describe('Wildcard (*) matching', () => {
    it('should match projects with wildcard prefix', () => {
      const result = evaluateFilter(tasks, '#work*', context)
      // Should match both 'work' and 'work-admin' projects
      expect(result.some(t => t.projectId === 'proj-1')).toBe(true)
      expect(result.some(t => t.projectId === 'proj-4')).toBe(true)
    })

    it('should match labels with wildcard', () => {
      const result = evaluateFilter(tasks, '@urgent*', context)
      // Should match both 'urgent' and 'urgent-blocker' labels
      expect(result.some(t => t.labels?.some((l: { name: string }) => l.name === 'urgent'))).toBe(true)
      expect(result.some(t => t.labels?.some((l: { name: string }) => l.name === 'urgent-blocker'))).toBe(true)
    })

    it('should match sections with wildcard', () => {
      const result = evaluateFilter(tasks, '/*progress*', context)
      // Should match 'in progress' section
      expect(result.length).toBeGreaterThan(0)
    })
  })
})

// Implementation for testing
function evaluateFilter(
  tasks: any[],
  query: string,
  context: { projects: Map<string, string>; labels: Map<string, string> }
): any[] {
  const normalizedQuery = query.toLowerCase().trim()

  if (!normalizedQuery) {
    return tasks.filter(t => !t.completed && !t.deletedAt)
  }

  return tasks.filter(task => {
    if (task.completed || task.deletedAt) return false
    return evaluateExpression(task, normalizedQuery, context)
  })
}

function evaluateExpression(
  task: any,
  query: string,
  context: { projects: Map<string, string>; labels: Map<string, string> }
): boolean {
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

function evaluateExpressionWithoutParens(
  task: any,
  query: string,
  context: { projects: Map<string, string>; labels: Map<string, string> }
): boolean {
  // Handle TRUE/FALSE placeholders
  if (query.toLowerCase() === 'true') return true
  if (query.toLowerCase() === 'false') return false

  // Handle OR (|)
  if (query.includes('|')) {
    const parts = query.split('|').map(p => p.trim())
    return parts.some(part => evaluateExpressionWithoutParens(task, part, context))
  }

  // Handle AND (&)
  if (query.includes('&')) {
    const parts = query.split('&').map(p => p.trim())
    return parts.every(part => evaluateExpressionWithoutParens(task, part, context))
  }

  // Handle negation (!)
  if (query.startsWith('!') && query.length > 1) {
    return !evaluateCondition(task, query.slice(1), context)
  }

  return evaluateCondition(task, query, context)
}

function matchWildcard(pattern: string, str: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const regexPattern = escaped.replace(/\*/g, '.*')
  const regex = new RegExp(`^${regexPattern}$`, 'i')
  return regex.test(str)
}

function evaluateCondition(
  task: any,
  condition: string,
  context: { projects: Map<string, string>; labels: Map<string, string>; sections?: Map<string, string> }
): boolean {
  const c = condition.toLowerCase().trim()

  // Recurring
  if (c === 'recurring') {
    return task.recurrenceRule !== null && task.recurrenceRule !== ''
  }

  // Assigned/unassigned
  if (c === 'assigned') {
    return task.projectId !== null
  }
  if (c === 'unassigned') {
    return task.projectId === null
  }

  // has: prefix
  if (c === 'has:date') {
    return task.dueDate !== null
  }
  if (c === 'has:deadline') {
    return task.deadline !== null
  }
  if (c === 'has:duration') {
    return task.duration !== null && task.duration > 0
  }
  if (c === 'has:description') {
    return task.description !== null && task.description !== ''
  }
  if (c === 'has:labels') {
    return task.labels && task.labels.length > 0
  }

  // No deadline
  if (c === 'no deadline') {
    return task.deadline === null
  }

  // Deadline filtering
  if (c === 'deadline:today') {
    if (!task.deadline) return false
    const now = Date.now()
    const startOfToday = new Date(now).setHours(0, 0, 0, 0)
    const endOfToday = new Date(now).setHours(23, 59, 59, 999)
    return task.deadline >= startOfToday && task.deadline <= endOfToday
  }

  if (c === 'deadline:tomorrow') {
    if (!task.deadline) return false
    const now = Date.now()
    const tomorrow = now + 86400000
    const startOfTomorrow = new Date(tomorrow).setHours(0, 0, 0, 0)
    const endOfTomorrow = new Date(tomorrow).setHours(23, 59, 59, 999)
    return task.deadline >= startOfTomorrow && task.deadline <= endOfTomorrow
  }

  if (c === 'deadline:overdue') {
    if (!task.deadline) return false
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    return task.deadline < startOfToday
  }

  // Label (@name) - supports wildcard
  if (c.startsWith('@')) {
    const labelName = c.slice(1).trim()
    if (!task.labels || task.labels.length === 0) return false
    const hasWildcard = labelName.includes('*')
    if (hasWildcard) {
      return task.labels.some((l: any) => matchWildcard(labelName, l.name.toLowerCase()))
    }
    return task.labels.some((l: any) => l.name.toLowerCase() === labelName)
  }

  // Search (search:text)
  if (c.startsWith('search:')) {
    const searchTerm = c.slice(7).trim()
    const inContent = task.content.toLowerCase().includes(searchTerm)
    const inDescription = task.description?.toLowerCase().includes(searchTerm) || false
    return inContent || inDescription
  }

  // Priority (p1-p4)
  const priorityMatch = c.match(/^p([1-4])$/)
  if (priorityMatch) {
    return task.priority === parseInt(priorityMatch[1], 10)
  }

  // Project (#name) - supports wildcard
  if (c.startsWith('#')) {
    const projectName = c.slice(1).trim()
    const hasWildcard = projectName.includes('*')
    if (hasWildcard) {
      for (const [name, id] of context.projects) {
        if (matchWildcard(projectName, name) && task.projectId === id) {
          return true
        }
      }
      return false
    }
    const projectId = context.projects.get(projectName)
    return task.projectId === projectId
  }

  // Section (/name) - supports wildcard
  if (c.startsWith('/') && context.sections) {
    const sectionName = c.slice(1).trim()
    const hasWildcard = sectionName.includes('*')
    if (hasWildcard) {
      for (const [name, id] of context.sections) {
        if (matchWildcard(sectionName, name) && task.sectionId === id) {
          return true
        }
      }
      return false
    }
    const sectionId = context.sections.get(sectionName)
    return task.sectionId === sectionId
  }

  // No date
  if (c === 'no date' || c === 'no due date') {
    return task.dueDate === null
  }

  // Today (simplified for testing)
  if (c === 'today') {
    if (!task.dueDate) return false
    const now = Date.now()
    const startOfToday = new Date(now).setHours(0, 0, 0, 0)
    const endOfToday = new Date(now).setHours(23, 59, 59, 999)
    return task.dueDate >= startOfToday && task.dueDate <= endOfToday
  }

  // Overdue
  if (c === 'overdue') {
    if (!task.dueDate) return false
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    return task.dueDate < startOfToday
  }

  // Content search fallback
  if (task.content.toLowerCase().includes(c)) {
    return true
  }

  return false
}
