import { Database as SqlJsDatabase } from 'sql.js'
import { generateId, now } from '@shared/utils'
import type { Label, LabelCreate, LabelUpdate } from '@shared/types'
import { saveDatabase } from '../index'

interface LabelRow {
  id: string
  name: string
  color: string
  sort_order: number
  is_favorite: number
  created_at: number
}

export class LabelRepository {
  constructor(private db: SqlJsDatabase) {}

  private rowToLabel(row: LabelRow): Label {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      sortOrder: row.sort_order,
      isFavorite: row.is_favorite === 1,
      createdAt: row.created_at
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
    saveDatabase()
  }

  list(): Label[] {
    const rows = this.queryAll<LabelRow>(
      'SELECT * FROM labels ORDER BY sort_order ASC'
    )
    return rows.map((row) => this.rowToLabel(row))
  }

  get(id: string): Label | null {
    const row = this.queryOne<LabelRow>(
      'SELECT * FROM labels WHERE id = ?',
      [id]
    )
    return row ? this.rowToLabel(row) : null
  }

  getByName(name: string): Label | null {
    const row = this.queryOne<LabelRow>(
      'SELECT * FROM labels WHERE name = ?',
      [name]
    )
    return row ? this.rowToLabel(row) : null
  }

  create(data: LabelCreate): Label {
    const timestamp = now()
    const id = generateId()

    const result = this.queryOne<{ max_order: number | null }>(
      'SELECT MAX(sort_order) as max_order FROM labels'
    )
    const sortOrder = (result?.max_order ?? 0) + 1

    this.run(
      `INSERT INTO labels (id, name, color, sort_order, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.color ?? '#808080',
        sortOrder,
        data.isFavorite ? 1 : 0,
        timestamp
      ]
    )

    return this.get(id)!
  }

  update(id: string, data: LabelUpdate): Label | null {
    const existing = this.get(id)
    if (!existing) return null

    const updates: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      params.push(data.name)
    }
    if (data.color !== undefined) {
      updates.push('color = ?')
      params.push(data.color)
    }
    if (data.isFavorite !== undefined) {
      updates.push('is_favorite = ?')
      params.push(data.isFavorite ? 1 : 0)
    }

    if (updates.length > 0) {
      params.push(id)
      this.run(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`, params)
    }

    return this.get(id)
  }

  getTaskCount(id: string): number {
    const result = this.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM task_labels tl JOIN tasks t ON t.id = tl.task_id WHERE tl.label_id = ? AND t.deleted_at IS NULL',
      [id]
    )
    return result?.count ?? 0
  }

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false

    // Remove label from all tasks first
    this.run('DELETE FROM task_labels WHERE label_id = ?', [id])

    // Delete the label
    this.run('DELETE FROM labels WHERE id = ?', [id])

    return true
  }

  reorder(labelId: string, newOrder: number): Label | null {
    const existing = this.get(labelId)
    if (!existing) return null

    this.run(
      'UPDATE labels SET sort_order = ? WHERE id = ?',
      [newOrder, labelId]
    )

    return this.get(labelId)
  }
}
