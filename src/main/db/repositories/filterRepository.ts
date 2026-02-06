import { Database as SqlJsDatabase } from 'sql.js'
import { generateId, now } from '@shared/utils'
import type { Filter, FilterCreate, FilterUpdate } from '@shared/types'
import { saveDatabase } from '../index'

interface FilterRow {
  id: string
  name: string
  query: string
  color: string
  sort_order: number
  is_favorite: number
  created_at: number
}

export class FilterRepository {
  constructor(private db: SqlJsDatabase) {}

  private rowToFilter(row: FilterRow): Filter {
    return {
      id: row.id,
      name: row.name,
      query: row.query,
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

  list(): Filter[] {
    const rows = this.queryAll<FilterRow>(
      'SELECT * FROM filters ORDER BY sort_order ASC'
    )
    return rows.map((row) => this.rowToFilter(row))
  }

  get(id: string): Filter | null {
    const row = this.queryOne<FilterRow>(
      'SELECT * FROM filters WHERE id = ?',
      [id]
    )
    return row ? this.rowToFilter(row) : null
  }

  create(data: FilterCreate): Filter {
    const timestamp = now()
    const id = generateId()

    const result = this.queryOne<{ max_order: number | null }>(
      'SELECT MAX(sort_order) as max_order FROM filters'
    )
    const sortOrder = (result?.max_order ?? 0) + 1

    this.run(
      `INSERT INTO filters (id, name, query, color, sort_order, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.query,
        data.color ?? '#808080',
        sortOrder,
        data.isFavorite ? 1 : 0,
        timestamp
      ]
    )

    return this.get(id)!
  }

  update(id: string, data: FilterUpdate): Filter | null {
    const existing = this.get(id)
    if (!existing) return null

    const updates: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      params.push(data.name)
    }
    if (data.query !== undefined) {
      updates.push('query = ?')
      params.push(data.query)
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
      this.run(`UPDATE filters SET ${updates.join(', ')} WHERE id = ?`, params)
    }

    return this.get(id)
  }

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false

    this.run('DELETE FROM filters WHERE id = ?', [id])

    return true
  }

  reorder(filterId: string, newOrder: number): Filter | null {
    const existing = this.get(filterId)
    if (!existing) return null

    this.run(
      'UPDATE filters SET sort_order = ? WHERE id = ?',
      [newOrder, filterId]
    )

    return this.get(filterId)
  }
}
