import { Database as SqlJsDatabase } from 'sql.js'
import { generateId, now, startOfDay, endOfDay, addDays } from '@shared/utils'
import type { Task, TaskCreate, TaskUpdate, Priority } from '@shared/types'
import { INBOX_PROJECT_ID } from '@shared/constants'

export interface TaskFilter {
  projectId?: string | null
  sectionId?: string | null
  labelId?: string
  completed?: boolean
  parentId?: string | null
  includeDeleted?: boolean
}

interface TaskRow {
  id: string
  content: string
  description: string | null
  project_id: string | null
  section_id: string | null
  parent_id: string | null
  due_date: number | null
  deadline: number | null
  duration: number | null
  recurrence_rule: string | null
  priority: number
  completed: number
  completed_at: number | null
  sort_order: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export class TaskRepository {
  constructor(private db: SqlJsDatabase) {}

  private rowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      content: row.content,
      description: row.description,
      projectId: row.project_id,
      sectionId: row.section_id,
      parentId: row.parent_id,
      dueDate: row.due_date,
      deadline: row.deadline,
      duration: row.duration,
      recurrenceRule: row.recurrence_rule,
      priority: row.priority as Priority,
      completed: row.completed === 1,
      completedAt: row.completed_at,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    }
  }

  private queryAll<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params)
    }
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return results
  }

  private queryOne<T>(sql: string, params: unknown[] = []): T | null {
    const results = this.queryAll<T>(sql, params)
    return results[0] ?? null
  }

  private run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params)
  }

  list(filter: TaskFilter = {}): Task[] {
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const params: unknown[] = []

    if (!filter.includeDeleted) {
      sql += ' AND deleted_at IS NULL'
    }

    if (filter.projectId !== undefined) {
      if (filter.projectId === null) {
        sql += ' AND project_id IS NULL'
      } else {
        sql += ' AND project_id = ?'
        params.push(filter.projectId)
      }
    }

    if (filter.sectionId !== undefined) {
      if (filter.sectionId === null) {
        sql += ' AND section_id IS NULL'
      } else {
        sql += ' AND section_id = ?'
        params.push(filter.sectionId)
      }
    }

    if (filter.parentId !== undefined) {
      if (filter.parentId === null) {
        sql += ' AND parent_id IS NULL'
      } else {
        sql += ' AND parent_id = ?'
        params.push(filter.parentId)
      }
    }

    if (filter.completed !== undefined) {
      sql += ' AND completed = ?'
      params.push(filter.completed ? 1 : 0)
    }

    sql += ' ORDER BY sort_order ASC'

    let rows = this.queryAll<TaskRow>(sql, params)

    // Filter by label if specified
    if (filter.labelId) {
      const taskIdsWithLabel = this.queryAll<{ task_id: string }>(
        'SELECT task_id FROM task_labels WHERE label_id = ?',
        [filter.labelId]
      ).map((r) => r.task_id)

      rows = rows.filter((row) => taskIdsWithLabel.includes(row.id))
    }

    return rows.map((row) => this.rowToTask(row))
  }

  get(id: string): Task | null {
    const row = this.queryOne<TaskRow>(
      'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
    return row ? this.rowToTask(row) : null
  }

  create(data: TaskCreate): Task {
    const timestamp = now()
    const id = generateId()

    // Determine actual project ID
    const actualProjectId = data.projectId ?? INBOX_PROJECT_ID

    // Calculate sort order - match on actual project/section/parent
    let sql = 'SELECT MAX(sort_order) as max_order FROM tasks WHERE deleted_at IS NULL'
    const orderParams: unknown[] = []

    sql += ' AND project_id = ?'
    orderParams.push(actualProjectId)

    if (data.sectionId) {
      sql += ' AND section_id = ?'
      orderParams.push(data.sectionId)
    } else {
      sql += ' AND section_id IS NULL'
    }

    if (data.parentId) {
      sql += ' AND parent_id = ?'
      orderParams.push(data.parentId)
    } else {
      sql += ' AND parent_id IS NULL'
    }

    const result = this.queryOne<{ max_order: number | null }>(sql, orderParams)
    const sortOrder = (result?.max_order ?? 0) + 1

    // Parse due date if string
    let dueDate = data.dueDate
    if (typeof dueDate === 'string') {
      dueDate = null
    }

    this.run(
      `INSERT INTO tasks (id, content, description, project_id, section_id, parent_id,
       due_date, deadline, duration, recurrence_rule, priority, completed, completed_at,
       sort_order, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, NULL)`,
      [
        id,
        data.content,
        data.description ?? null,
        data.projectId ?? INBOX_PROJECT_ID,
        data.sectionId ?? null,
        data.parentId ?? null,
        typeof dueDate === 'number' ? dueDate : null,
        data.deadline ?? null,
        data.duration ?? null,
        data.recurrenceRule ?? null,
        data.priority ?? 4,
        sortOrder,
        timestamp,
        timestamp
      ]
    )

    // Add labels if provided
    if (data.labelIds && data.labelIds.length > 0) {
      for (const labelId of data.labelIds) {
        this.run(
          'INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)',
          [id, labelId]
        )
      }
    }

    return this.get(id)!
  }

  update(id: string, data: TaskUpdate): Task | null {
    const existing = this.get(id)
    if (!existing) return null

    const timestamp = now()
    const updates: string[] = ['updated_at = ?']
    const params: unknown[] = [timestamp]

    if (data.content !== undefined) {
      updates.push('content = ?')
      params.push(data.content)
    }
    if (data.description !== undefined) {
      updates.push('description = ?')
      params.push(data.description)
    }
    if (data.projectId !== undefined) {
      updates.push('project_id = ?')
      params.push(data.projectId)
    }
    if (data.sectionId !== undefined) {
      updates.push('section_id = ?')
      params.push(data.sectionId)
    }
    if (data.parentId !== undefined) {
      updates.push('parent_id = ?')
      params.push(data.parentId)
    }
    if (data.dueDate !== undefined && typeof data.dueDate !== 'string') {
      updates.push('due_date = ?')
      params.push(data.dueDate)
    }
    if (data.deadline !== undefined) {
      updates.push('deadline = ?')
      params.push(data.deadline)
    }
    if (data.duration !== undefined) {
      updates.push('duration = ?')
      params.push(data.duration)
    }
    if (data.recurrenceRule !== undefined) {
      updates.push('recurrence_rule = ?')
      params.push(data.recurrenceRule)
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?')
      params.push(data.priority)
    }

    params.push(id)
    this.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params)

    // Update labels if provided
    if (data.labelIds !== undefined) {
      this.run('DELETE FROM task_labels WHERE task_id = ?', [id])
      for (const labelId of data.labelIds) {
        this.run(
          'INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)',
          [id, labelId]
        )
      }
    }

    return this.get(id)
  }

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false

    const timestamp = now()
    this.run(
      'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [timestamp, timestamp, id]
    )

    // Also delete subtasks
    this.run(
      'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE parent_id = ?',
      [timestamp, timestamp, id]
    )

    return true
  }

  complete(id: string): Task | null {
    const existing = this.get(id)
    if (!existing) return null

    const timestamp = now()
    this.run(
      'UPDATE tasks SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?',
      [timestamp, timestamp, id]
    )

    return this.get(id)
  }

  uncomplete(id: string): Task | null {
    const existing = this.get(id)
    if (!existing) return null

    const timestamp = now()
    this.run(
      'UPDATE tasks SET completed = 0, completed_at = NULL, updated_at = ? WHERE id = ?',
      [timestamp, id]
    )

    return this.get(id)
  }

  reorder(taskId: string, newOrder: number, newParentId?: string | null): Task | null {
    const existing = this.get(taskId)
    if (!existing) return null

    const timestamp = now()
    if (newParentId !== undefined) {
      this.run(
        'UPDATE tasks SET sort_order = ?, parent_id = ?, updated_at = ? WHERE id = ?',
        [newOrder, newParentId, timestamp, taskId]
      )
    } else {
      this.run(
        'UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?',
        [newOrder, timestamp, taskId]
      )
    }

    return this.get(taskId)
  }

  getToday(): Task[] {
    const todayStart = startOfDay()
    const todayEnd = endOfDay()

    const rows = this.queryAll<TaskRow>(
      `SELECT * FROM tasks
       WHERE deleted_at IS NULL
         AND completed = 0
         AND ((due_date >= ? AND due_date <= ?) OR due_date <= ?)
       ORDER BY due_date ASC, priority ASC, sort_order ASC`,
      [todayStart, todayEnd, todayStart]
    )

    return rows.map((row) => this.rowToTask(row))
  }

  getUpcoming(days: number = 7): Task[] {
    const todayStart = startOfDay()
    const futureEnd = endOfDay(addDays(Date.now(), days))

    const rows = this.queryAll<TaskRow>(
      `SELECT * FROM tasks
       WHERE deleted_at IS NULL
         AND completed = 0
         AND due_date >= ?
         AND due_date <= ?
       ORDER BY due_date ASC, priority ASC, sort_order ASC`,
      [todayStart, futureEnd]
    )

    return rows.map((row) => this.rowToTask(row))
  }

  getOverdue(): Task[] {
    const todayStart = startOfDay()

    const rows = this.queryAll<TaskRow>(
      `SELECT * FROM tasks
       WHERE deleted_at IS NULL
         AND completed = 0
         AND due_date < ?
       ORDER BY due_date ASC, priority ASC`,
      [todayStart]
    )

    return rows.map((row) => this.rowToTask(row))
  }

  search(query: string): Task[] {
    const searchPattern = `%${query}%`

    const rows = this.queryAll<TaskRow>(
      `SELECT * FROM tasks
       WHERE deleted_at IS NULL
         AND (content LIKE ? OR description LIKE ?)
       ORDER BY updated_at DESC
       LIMIT 50`,
      [searchPattern, searchPattern]
    )

    return rows.map((row) => this.rowToTask(row))
  }

  getLabels(taskId: string): { id: string; name: string; color: string }[] {
    return this.queryAll<{ id: string; name: string; color: string }>(
      `SELECT l.id, l.name, l.color
       FROM task_labels tl
       JOIN labels l ON tl.label_id = l.id
       WHERE tl.task_id = ?`,
      [taskId]
    )
  }

  getSubtasks(taskId: string): Task[] {
    return this.list({ parentId: taskId })
  }
}
