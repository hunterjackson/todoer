import { describe, it, expect } from 'vitest'
import { exportToJSON, importFromJSON, exportToCSV, importFromCSV } from '../../../src/main/services/dataExport'

describe('Data Export', () => {
  describe('exportToJSON', () => {
    it('should export tasks to JSON format', () => {
      const tasks = [
        { id: '1', content: 'Task 1', priority: 1, completed: false },
        { id: '2', content: 'Task 2', priority: 2, completed: true }
      ]

      const result = exportToJSON({ tasks, projects: [], labels: [] } as any)
      const parsed = JSON.parse(result)

      expect(parsed.tasks).toHaveLength(2)
      expect(parsed.version).toBe(1)
      expect(parsed.exportedAt).toBeDefined()
    })

    it('should include projects and labels', () => {
      const data = {
        tasks: [],
        projects: [{ id: 'p1', name: 'Project 1' }],
        labels: [{ id: 'l1', name: 'Label 1' }]
      }

      const result = exportToJSON(data as any)
      const parsed = JSON.parse(result)

      expect(parsed.projects).toHaveLength(1)
      expect(parsed.labels).toHaveLength(1)
    })
  })

  describe('exportToCSV', () => {
    it('should export tasks to CSV format', () => {
      const tasks = [
        { id: '1', content: 'Task 1', priority: 1, completed: false, dueDate: null },
        { id: '2', content: 'Task with, comma', priority: 2, completed: true, dueDate: 1704067200000 }
      ]

      const result = exportToCSV(tasks as any)
      const lines = result.split('\n')

      // Header + 2 data rows
      expect(lines.length).toBeGreaterThanOrEqual(3)
      expect(lines[0]).toContain('content')
      expect(lines[0]).toContain('priority')
      // Comma in content should be escaped
      expect(lines[2]).toContain('"Task with, comma"')
    })

    it('should handle empty tasks', () => {
      const result = exportToCSV([])
      const lines = result.split('\n').filter(Boolean)

      // Should only have header
      expect(lines.length).toBe(1)
    })
  })
})

describe('Data Import', () => {
  describe('importFromJSON', () => {
    it('should parse valid JSON export', () => {
      const jsonStr = JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        tasks: [{ id: '1', content: 'Task 1' }],
        projects: [],
        labels: []
      })

      const result = importFromJSON(jsonStr)

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].content).toBe('Task 1')
    })

    it('should throw on invalid JSON', () => {
      expect(() => importFromJSON('invalid json')).toThrow()
    })

    it('should throw on missing required fields', () => {
      expect(() => importFromJSON('{}')).toThrow()
    })

    it('should round-trip attachments with base64 data', () => {
      const exportData = {
        tasks: [{ id: 't1', content: 'Task 1', createdAt: 1000, updatedAt: 1000 }] as any[],
        projects: [] as any[],
        labels: [] as any[],
        filters: [] as any[],
        attachments: [
          {
            id: 'a1',
            taskId: 't1',
            filename: 'test.txt',
            mimeType: 'text/plain',
            size: 11,
            createdAt: 4000,
            dataBase64: Buffer.from('hello world').toString('base64')
          },
          {
            id: 'a2',
            taskId: 't1',
            filename: 'image.png',
            mimeType: 'image/png',
            size: 4,
            createdAt: 5000,
            dataBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')
          }
        ]
      }

      const json = exportToJSON(exportData)
      const result = importFromJSON(json)

      expect(result.attachments).toHaveLength(2)
      expect(result.attachments![0].filename).toBe('test.txt')
      expect(result.attachments![0].dataBase64).toBe(Buffer.from('hello world').toString('base64'))
      // Verify base64 can be decoded back
      expect(Buffer.from(result.attachments![0].dataBase64, 'base64').toString()).toBe('hello world')
      expect(result.attachments![1].filename).toBe('image.png')
      expect(result.attachments![1].mimeType).toBe('image/png')
    })

    it('should handle missing attachments gracefully', () => {
      const exportData = {
        tasks: [{ id: 't1', content: 'Task 1', createdAt: 1000, updatedAt: 1000 }] as any[],
        projects: [] as any[],
        labels: [] as any[],
        filters: [] as any[]
        // no attachments field
      }

      const json = exportToJSON(exportData)
      const result = importFromJSON(json)

      expect(result.attachments).toEqual([])
    })

    it('should round-trip comments, reminders, settings, and karma', () => {
      const exportData = {
        tasks: [{ id: 't1', content: 'Task 1', createdAt: 1000, updatedAt: 1000 }] as any[],
        projects: [{ id: 'p1', name: 'Proj' }] as any[],
        labels: [] as any[],
        filters: [] as any[],
        sections: [] as any[],
        comments: [
          { id: 'c1', taskId: 't1', projectId: null, content: 'A comment', createdAt: 2000, updatedAt: 2000 },
          { id: 'c2', taskId: null, projectId: 'p1', content: 'Project note', createdAt: 3000, updatedAt: 3000 }
        ] as any[],
        reminders: [
          { id: 'r1', taskId: 't1', remindAt: 5000, notified: false }
        ] as any[],
        settings: { theme: 'dark', confirmDelete: 'true' },
        karmaStats: { id: 'default', totalPoints: 42, currentStreak: 3, longestStreak: 7, dailyGoal: 5, weeklyGoal: 25 } as any,
        karmaHistory: [
          { id: 'kh1', date: '2025-01-01', points: 10, tasksCompleted: 5 }
        ] as any[]
      }

      const json = exportToJSON(exportData)
      const result = importFromJSON(json)

      // Comments
      expect(result.comments).toHaveLength(2)
      expect(result.comments![0].content).toBe('A comment')
      expect(result.comments![1].projectId).toBe('p1')

      // Reminders
      expect(result.reminders).toHaveLength(1)
      expect(result.reminders![0].remindAt).toBe(5000)

      // Settings
      expect(result.settings).toEqual({ theme: 'dark', confirmDelete: 'true' })

      // Karma stats
      expect(result.karmaStats!.totalPoints).toBe(42)
      expect(result.karmaStats!.currentStreak).toBe(3)

      // Karma history
      expect(result.karmaHistory).toHaveLength(1)
      expect(result.karmaHistory![0].tasksCompleted).toBe(5)
    })
  })

  describe('importFromCSV', () => {
    it('should parse valid CSV', () => {
      const csv = `content,priority,completed,dueDate
Task 1,1,false,
Task 2,2,true,2024-01-01`

      const result = importFromCSV(csv)

      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Task 1')
      expect(result[0].priority).toBe(1)
      expect(result[1].completed).toBe(true)
    })

    it('should handle quoted fields with commas', () => {
      const csv = `content,priority
"Task with, comma",1`

      const result = importFromCSV(csv)

      expect(result[0].content).toBe('Task with, comma')
    })
  })
})
