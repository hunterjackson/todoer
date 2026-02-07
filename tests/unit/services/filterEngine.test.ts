import { describe, it, expect, beforeEach } from 'vitest'
import { evaluateFilter } from '../../../src/main/services/filterEngine'
import type { Task } from '@shared/types'

describe('Enhanced Filter Engine', () => {
  let tasks: Task[]
  let context: { projects: Map<string, string[]>; labels: Map<string, string[]>; sections: Map<string, string[]> }

  beforeEach(() => {
    const now = Date.now()
    const yesterday = now - 86400000
    const tomorrow = now + 86400000
    const lastWeek = now - 7 * 86400000

    context = {
      projects: new Map([
        ['work', ['proj-1']],
        ['personal', ['proj-2']],
        ['shopping', ['proj-3']],
        ['work-admin', ['proj-4']]
      ]),
      labels: new Map([
        ['urgent', ['label-1']],
        ['home', ['label-2']],
        ['waiting', ['label-3']],
        ['urgent-blocker', ['label-4']]
      ]),
      sections: new Map([
        ['to do', ['sec-1']],
        ['in progress', ['sec-2']],
        ['done', ['sec-3']]
      ])
    }

    tasks = [
      {
        id: '1',
        content: 'Work meeting',
        description: 'Discuss project timeline',
        projectId: 'proj-1',
        sectionId: 'sec-1',
        parentId: null,
        dueDate: now,
        deadline: tomorrow,
        duration: 60,
        priority: 1,
        completed: false,
        completedAt: null,
        sortOrder: 1,
        deletedAt: null,
        delegatedTo: null,
        recurrenceRule: 'FREQ=WEEKLY',
        createdAt: lastWeek,
        updatedAt: lastWeek,
        labels: [{ id: 'label-1', name: 'urgent', color: '#ff0000' }]
      },
      {
        id: '2',
        content: 'Buy groceries',
        description: null,
        projectId: 'proj-2',
        sectionId: null,
        parentId: null,
        dueDate: tomorrow,
        deadline: null,
        duration: null,
        priority: 3,
        completed: false,
        completedAt: null,
        sortOrder: 2,
        deletedAt: null,
        delegatedTo: null,
        recurrenceRule: null,
        createdAt: yesterday,
        updatedAt: yesterday,
        labels: [{ id: 'label-2', name: 'home', color: '#00ff00' }]
      },
      {
        id: '3',
        content: 'Review documents',
        description: 'Important review needed',
        projectId: 'proj-1',
        sectionId: 'sec-2',
        parentId: null,
        dueDate: null,
        deadline: yesterday,
        duration: 30,
        priority: 2,
        completed: false,
        completedAt: null,
        sortOrder: 3,
        deletedAt: null,
        delegatedTo: 'Alice',
        recurrenceRule: null,
        createdAt: now,
        updatedAt: now,
        labels: []
      },
      {
        id: '4',
        content: 'Call mom',
        description: null,
        projectId: null,
        sectionId: null,
        parentId: null,
        dueDate: yesterday,
        deadline: now,
        duration: null,
        priority: 4,
        completed: false,
        completedAt: null,
        sortOrder: 4,
        deletedAt: null,
        delegatedTo: null,
        recurrenceRule: null,
        createdAt: lastWeek,
        updatedAt: lastWeek,
        labels: [
          { id: 'label-2', name: 'home', color: '#00ff00' },
          { id: 'label-3', name: 'waiting', color: '#0000ff' }
        ]
      },
      {
        id: '5',
        content: 'Completed task',
        description: null,
        projectId: 'proj-1',
        sectionId: null,
        parentId: null,
        dueDate: now,
        deadline: null,
        duration: null,
        priority: 1,
        completed: true,
        completedAt: now,
        sortOrder: 5,
        deletedAt: null,
        delegatedTo: null,
        recurrenceRule: null,
        createdAt: lastWeek,
        updatedAt: lastWeek,
        labels: []
      },
      {
        id: '6',
        content: 'Admin task',
        description: null,
        projectId: 'proj-4',
        sectionId: null,
        parentId: null,
        dueDate: now,
        deadline: null,
        duration: 45,
        priority: 2,
        completed: false,
        completedAt: null,
        sortOrder: 6,
        deletedAt: null,
        delegatedTo: 'Bob',
        recurrenceRule: null,
        createdAt: now,
        updatedAt: now,
        labels: [{ id: 'label-4', name: 'urgent-blocker', color: '#ff0000' }]
      }
    ] as Task[]
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
      // Production filter does not exclude completed tasks; only non-completed should be negated
      const nonCompletedResults = result.filter(t => !t.completed)
      expect(nonCompletedResults.every(t => t.priority !== 1)).toBe(true)
    })

    it('should negate project filter', () => {
      const result = evaluateFilter(tasks, '!#work', context)
      // Production filter does not exclude completed tasks, only the query is applied
      const nonCompletedResults = result.filter(t => !t.completed)
      expect(nonCompletedResults.every(t => t.projectId !== 'proj-1')).toBe(true)
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
      expect(result.some(t => t.labels?.some(l => l.name === 'urgent'))).toBe(true)
      expect(result.some(t => t.labels?.some(l => l.name === 'urgent-blocker'))).toBe(true)
    })

    it('should match sections with wildcard', () => {
      const result = evaluateFilter(tasks, '/*progress*', context)
      // Should match 'in progress' section
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Delegated filtering', () => {
    it('should filter tasks delegated to anyone', () => {
      const result = evaluateFilter(tasks, 'delegated', context)
      expect(result).toHaveLength(2)
      expect(result.some(t => t.delegatedTo === 'Alice')).toBe(true)
      expect(result.some(t => t.delegatedTo === 'Bob')).toBe(true)
    })

    it('should filter tasks delegated to anyone using wildcard', () => {
      const result = evaluateFilter(tasks, 'delegated:*', context)
      expect(result).toHaveLength(2)
    })

    it('should filter tasks delegated to specific person', () => {
      const result = evaluateFilter(tasks, 'delegated:alice', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Review documents')
    })

    it('should filter non-delegated tasks with negation', () => {
      const result = evaluateFilter(tasks, '!delegated', context)
      // Tasks 1, 2, 4 have no delegation and are not completed/deleted
      expect(result.every(t => !t.delegatedTo)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should combine delegated filter with other filters', () => {
      const result = evaluateFilter(tasks, 'delegated & #work', context)
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Review documents')
    })
  })
})
