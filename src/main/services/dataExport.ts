import type { Task, Project, Label, Filter, Section, Comment, Reminder, KarmaStats, KarmaHistory } from '@shared/types'

export interface ExportAttachment {
  id: string
  taskId: string
  filename: string
  mimeType: string
  size: number
  createdAt: number
  dataBase64: string
}

export interface ExportData {
  version: number
  exportedAt: number
  tasks: Task[]
  projects: Project[]
  labels: Label[]
  filters: Filter[]
  sections?: Section[]
  comments?: Comment[]
  reminders?: Reminder[]
  attachments?: ExportAttachment[]
  settings?: Record<string, string>
  karmaStats?: KarmaStats
  karmaHistory?: KarmaHistory[]
}

/**
 * Export all data to JSON format
 */
export function exportToJSON(data: Omit<ExportData, 'version' | 'exportedAt'>): string {
  const exportData: ExportData = {
    version: 1,
    exportedAt: Date.now(),
    ...data
  }
  return JSON.stringify(exportData, null, 2)
}

/**
 * Export tasks to CSV format
 */
export function exportToCSV(tasks: Task[]): string {
  const headers = [
    'content',
    'description',
    'priority',
    'completed',
    'dueDate',
    'projectId',
    'createdAt',
    'completedAt'
  ]

  const rows = tasks.map((task) => {
    return headers
      .map((h) => {
        const value = task[h as keyof Task]
        if (value === null || value === undefined) return ''

        // Format dates
        if (h === 'dueDate' || h === 'createdAt' || h === 'completedAt') {
          return value ? new Date(value as number).toISOString() : ''
        }

        // Escape strings with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }

        return String(value)
      })
      .join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

/**
 * Import data from JSON format
 */
export function importFromJSON(jsonStr: string): Omit<ExportData, 'version' | 'exportedAt'> {
  let data: ExportData

  try {
    data = JSON.parse(jsonStr)
  } catch {
    throw new Error('Invalid JSON format')
  }

  if (!data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Invalid export format: missing tasks array')
  }

  // Validate and clean task data
  const tasks = data.tasks.map((task) => ({
    ...task,
    id: task.id || generateId(),
    createdAt: task.createdAt || Date.now(),
    updatedAt: task.updatedAt || Date.now()
  }))

  return {
    tasks,
    projects: data.projects || [],
    labels: data.labels || [],
    filters: data.filters || [],
    sections: data.sections || [],
    comments: data.comments || [],
    reminders: data.reminders || [],
    attachments: data.attachments || [],
    settings: data.settings || {},
    karmaStats: data.karmaStats,
    karmaHistory: data.karmaHistory || []
  }
}

/**
 * Import tasks from CSV format
 */
export function importFromCSV(csv: string): Partial<Task>[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const tasks: Partial<Task>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const task: Record<string, unknown> = {}

    headers.forEach((header, index) => {
      let value: unknown = values[index] || ''

      // Type conversion
      if (header === 'priority') {
        value = parseInt(value as string, 10) || 4
      } else if (header === 'completed') {
        value = value === 'true' || value === '1'
      } else if (['dueDate', 'createdAt', 'completedAt', 'updatedAt'].includes(header)) {
        if (value) {
          const date = new Date(value as string)
          value = isNaN(date.getTime()) ? null : date.getTime()
        } else {
          value = null
        }
      }

      task[header] = value
    })

    // Ensure required fields
    if (task.content) {
      tasks.push(task as Partial<Task>)
    }
  }

  return tasks
}

/**
 * Parse a CSV line handling quoted fields
 */
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
