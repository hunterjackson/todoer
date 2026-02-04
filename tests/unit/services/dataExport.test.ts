import { describe, it, expect } from 'vitest'

describe('Data Export', () => {
  describe('exportToJSON', () => {
    it('should export tasks to JSON format', () => {
      const tasks = [
        { id: '1', content: 'Task 1', priority: 1, completed: false },
        { id: '2', content: 'Task 2', priority: 2, completed: true }
      ]

      const result = exportToJSON({ tasks, projects: [], labels: [] })
      const parsed = JSON.parse(result)

      expect(parsed.tasks).toHaveLength(2)
      expect(parsed.version).toBeDefined()
      expect(parsed.exportedAt).toBeDefined()
    })

    it('should include projects and labels', () => {
      const data = {
        tasks: [],
        projects: [{ id: 'p1', name: 'Project 1' }],
        labels: [{ id: 'l1', name: 'Label 1' }]
      }

      const result = exportToJSON(data)
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

      const result = exportToCSV(tasks)
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

// Implementation helpers
interface ExportData {
  tasks: any[]
  projects: any[]
  labels: any[]
}

function exportToJSON(data: ExportData): string {
  return JSON.stringify({
    version: 1,
    exportedAt: Date.now(),
    ...data
  }, null, 2)
}

function exportToCSV(tasks: any[]): string {
  const headers = ['content', 'priority', 'completed', 'dueDate', 'projectId']
  const rows = tasks.map(task => {
    return headers.map(h => {
      const value = task[h]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return String(value)
    }).join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

function importFromJSON(jsonStr: string): ExportData {
  const data = JSON.parse(jsonStr)

  if (!data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Invalid export format: missing tasks array')
  }

  return {
    tasks: data.tasks,
    projects: data.projects || [],
    labels: data.labels || []
  }
}

function importFromCSV(csv: string): any[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const tasks: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const task: any = {}

    headers.forEach((header, index) => {
      let value: any = values[index] || ''

      // Type conversion
      if (header === 'priority') {
        value = parseInt(value, 10) || 4
      } else if (header === 'completed') {
        value = value === 'true'
      }

      task[header] = value
    })

    tasks.push(task)
  }

  return tasks
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}
