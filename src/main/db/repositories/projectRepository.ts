import { Database as SqlJsDatabase } from 'sql.js'
import { generateId, now } from '@shared/utils'
import type { Project, ProjectCreate, ProjectUpdate } from '@shared/types'

interface ProjectRow {
  id: string
  name: string
  color: string
  parent_id: string | null
  sort_order: number
  view_mode: string
  is_favorite: number
  archived_at: number | null
  created_at: number
  deleted_at: number | null
}

export class ProjectRepository {
  constructor(private db: SqlJsDatabase) {}

  private rowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      viewMode: row.view_mode as 'list' | 'board',
      isFavorite: row.is_favorite === 1,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
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

  list(includeDeleted: boolean = false): Project[] {
    let sql = 'SELECT * FROM projects'
    if (!includeDeleted) {
      sql += ' WHERE deleted_at IS NULL'
    }
    sql += ' ORDER BY sort_order ASC'

    const rows = this.queryAll<ProjectRow>(sql)
    return rows.map((row) => this.rowToProject(row))
  }

  get(id: string): Project | null {
    const row = this.queryOne<ProjectRow>(
      'SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
    return row ? this.rowToProject(row) : null
  }

  create(data: ProjectCreate): Project {
    const timestamp = now()
    const id = generateId()

    const result = this.queryOne<{ max_order: number | null }>(
      'SELECT MAX(sort_order) as max_order FROM projects WHERE deleted_at IS NULL'
    )
    const sortOrder = (result?.max_order ?? 0) + 1

    this.run(
      `INSERT INTO projects (id, name, color, parent_id, sort_order, view_mode, is_favorite, archived_at, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
      [
        id,
        data.name,
        data.color ?? '#808080',
        data.parentId ?? null,
        sortOrder,
        data.viewMode ?? 'list',
        data.isFavorite ? 1 : 0,
        timestamp
      ]
    )

    return this.get(id)!
  }

  update(id: string, data: ProjectUpdate): Project | null {
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
    if (data.parentId !== undefined) {
      updates.push('parent_id = ?')
      params.push(data.parentId)
    }
    if (data.viewMode !== undefined) {
      updates.push('view_mode = ?')
      params.push(data.viewMode)
    }
    if (data.isFavorite !== undefined) {
      updates.push('is_favorite = ?')
      params.push(data.isFavorite ? 1 : 0)
    }
    if (data.archivedAt !== undefined) {
      updates.push('archived_at = ?')
      params.push(data.archivedAt)
    }

    if (updates.length > 0) {
      params.push(id)
      this.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params)
    }

    return this.get(id)
  }

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false

    const timestamp = now()
    this.run(
      'UPDATE projects SET deleted_at = ? WHERE id = ?',
      [timestamp, id]
    )

    // Also delete subprojects
    this.run(
      'UPDATE projects SET deleted_at = ? WHERE parent_id = ?',
      [timestamp, id]
    )

    return true
  }

  reorder(projectId: string, newOrder: number): Project | null {
    const existing = this.get(projectId)
    if (!existing) return null

    this.run(
      'UPDATE projects SET sort_order = ? WHERE id = ?',
      [newOrder, projectId]
    )

    return this.get(projectId)
  }

  getTaskCount(projectId: string, includeCompleted: boolean = false): number {
    let sql = 'SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND deleted_at IS NULL'
    if (!includeCompleted) {
      sql += ' AND completed = 0'
    }

    const result = this.queryOne<{ count: number }>(sql, [projectId])
    return result?.count ?? 0
  }
}
