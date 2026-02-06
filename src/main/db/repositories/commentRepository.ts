import type { Database } from 'sql.js'
import type { Comment, CommentCreate, CommentUpdate } from '@shared/types'
import { saveDatabase } from '../index'
import { sanitizeHtml } from '@shared/utils'

interface CommentRow {
  id: string
  task_id: string | null
  project_id: string | null
  content: string
  created_at: number
  updated_at: number
}

export class CommentRepository {
  constructor(private db: Database) {}

  private run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params)
    saveDatabase()
  }

  private rowToComment(row: CommentRow): Comment {
    return {
      id: row.id,
      taskId: row.task_id,
      projectId: row.project_id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  create(data: CommentCreate): Comment {
    const id = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()
    const sanitizedContent = sanitizeHtml(data.content)

    this.run(
      `INSERT INTO comments (id, task_id, project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.taskId || null, data.projectId || null, sanitizedContent, now, now]
    )

    return this.get(id)!
  }

  get(id: string): Comment | null {
    const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?')
    stmt.bind([id])

    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as CommentRow
      stmt.free()
      return this.rowToComment(row)
    }

    stmt.free()
    return null
  }

  listAll(): Comment[] {
    const stmt = this.db.prepare(
      'SELECT * FROM comments ORDER BY created_at ASC'
    )

    const comments: Comment[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as CommentRow
      comments.push(this.rowToComment(row))
    }
    stmt.free()

    return comments
  }

  list(taskId: string): Comment[] {
    const stmt = this.db.prepare(
      'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC'
    )
    stmt.bind([taskId])

    const comments: Comment[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as CommentRow
      comments.push(this.rowToComment(row))
    }
    stmt.free()

    return comments
  }

  listByProject(projectId: string): Comment[] {
    const stmt = this.db.prepare(
      'SELECT * FROM comments WHERE project_id = ? ORDER BY created_at ASC'
    )
    stmt.bind([projectId])

    const comments: Comment[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as CommentRow
      comments.push(this.rowToComment(row))
    }
    stmt.free()

    return comments
  }

  update(id: string, data: CommentUpdate): Comment {
    const now = Date.now()
    const sanitizedContent = sanitizeHtml(data.content)
    this.run(`UPDATE comments SET content = ?, updated_at = ? WHERE id = ?`, [
      sanitizedContent,
      now,
      id
    ])

    return this.get(id)!
  }

  delete(id: string): void {
    this.run('DELETE FROM comments WHERE id = ?', [id])
  }

  deleteByTask(taskId: string): void {
    this.run('DELETE FROM comments WHERE task_id = ?', [taskId])
  }

  deleteByProject(projectId: string): void {
    this.run('DELETE FROM comments WHERE project_id = ?', [projectId])
  }

  count(taskId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM comments WHERE task_id = ?')
    stmt.bind([taskId])
    stmt.step()
    const row = stmt.getAsObject() as { count: number }
    stmt.free()
    return row.count
  }

  countByProject(projectId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM comments WHERE project_id = ?')
    stmt.bind([projectId])
    stmt.step()
    const row = stmt.getAsObject() as { count: number }
    stmt.free()
    return row.count
  }
}
