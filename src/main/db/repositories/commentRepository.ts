import type { Database } from 'sql.js'
import type { Comment, CommentCreate, CommentUpdate } from '@shared/types'

export class CommentRepository {
  constructor(private db: Database) {}

  create(data: CommentCreate): Comment {
    const id = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    this.db.run(
      `INSERT INTO comments (id, task_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, data.taskId, data.content, now, now]
    )

    return this.get(id)!
  }

  get(id: string): Comment | null {
    const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?')
    stmt.bind([id])

    if (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string
        task_id: string
        content: string
        created_at: number
        updated_at: number
      }
      stmt.free()
      return {
        id: row.id,
        taskId: row.task_id,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }

    stmt.free()
    return null
  }

  list(taskId: string): Comment[] {
    const stmt = this.db.prepare(
      'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC'
    )
    stmt.bind([taskId])

    const comments: Comment[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string
        task_id: string
        content: string
        created_at: number
        updated_at: number
      }
      comments.push({
        id: row.id,
        taskId: row.task_id,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })
    }
    stmt.free()

    return comments
  }

  update(id: string, data: CommentUpdate): Comment {
    const now = Date.now()
    this.db.run(`UPDATE comments SET content = ?, updated_at = ? WHERE id = ?`, [
      data.content,
      now,
      id
    ])

    return this.get(id)!
  }

  delete(id: string): void {
    this.db.run('DELETE FROM comments WHERE id = ?', [id])
  }

  deleteByTask(taskId: string): void {
    this.db.run('DELETE FROM comments WHERE task_id = ?', [taskId])
  }

  count(taskId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM comments WHERE task_id = ?')
    stmt.bind([taskId])
    stmt.step()
    const row = stmt.getAsObject() as { count: number }
    stmt.free()
    return row.count
  }
}
