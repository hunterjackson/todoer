import { Database as SqlJsDatabase } from 'sql.js'
import { generateId, now } from '@shared/utils'
import type { Section, SectionCreate, SectionUpdate } from '@shared/types'
import { saveDatabase } from '../index'

interface SectionRow {
  id: string
  name: string
  project_id: string
  sort_order: number
  is_collapsed: number
  created_at: number
}

export class SectionRepository {
  constructor(private db: SqlJsDatabase) {}

  private rowToSection(row: SectionRow): Section {
    return {
      id: row.id,
      name: row.name,
      projectId: row.project_id,
      sortOrder: row.sort_order,
      isCollapsed: row.is_collapsed === 1,
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

  list(projectId: string): Section[] {
    const rows = this.queryAll<SectionRow>(
      'SELECT * FROM sections WHERE project_id = ? ORDER BY sort_order ASC',
      [projectId]
    )
    return rows.map((row) => this.rowToSection(row))
  }

  listAll(): Section[] {
    const rows = this.queryAll<SectionRow>(
      'SELECT * FROM sections ORDER BY project_id, sort_order ASC'
    )
    return rows.map((row) => this.rowToSection(row))
  }

  get(id: string): Section | null {
    const row = this.queryOne<SectionRow>(
      'SELECT * FROM sections WHERE id = ?',
      [id]
    )
    return row ? this.rowToSection(row) : null
  }

  create(data: SectionCreate): Section {
    const timestamp = now()
    const id = generateId()

    const result = this.queryOne<{ max_order: number | null }>(
      'SELECT MAX(sort_order) as max_order FROM sections WHERE project_id = ?',
      [data.projectId]
    )
    const sortOrder = (result?.max_order ?? 0) + 1

    this.run(
      `INSERT INTO sections (id, name, project_id, sort_order, is_collapsed, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, data.name, data.projectId, sortOrder, timestamp]
    )

    return this.get(id)!
  }

  update(id: string, data: SectionUpdate): Section | null {
    const existing = this.get(id)
    if (!existing) return null

    const updates: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      params.push(data.name)
    }
    if (data.isCollapsed !== undefined) {
      updates.push('is_collapsed = ?')
      params.push(data.isCollapsed ? 1 : 0)
    }

    if (updates.length > 0) {
      params.push(id)
      this.run(`UPDATE sections SET ${updates.join(', ')} WHERE id = ?`, params)
    }

    return this.get(id)
  }

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false

    // Move tasks in this section to no section
    this.run(
      'UPDATE tasks SET section_id = NULL, updated_at = ? WHERE section_id = ?',
      [now(), id]
    )

    // Delete the section
    this.run('DELETE FROM sections WHERE id = ?', [id])

    return true
  }

  reorder(sectionId: string, newOrder: number): Section | null {
    const existing = this.get(sectionId)
    if (!existing) return null

    this.run(
      'UPDATE sections SET sort_order = ? WHERE id = ?',
      [newOrder, sectionId]
    )

    return this.get(sectionId)
  }
}
