import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'

// Comment repository tests
describe('Comment Repository', () => {
  let db: Database
  let commentRepo: CommentRepository
  let taskId: string

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()

    // Create tables
    db.run(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        description TEXT,
        project_id TEXT,
        section_id TEXT,
        parent_id TEXT,
        due_date INTEGER,
        deadline INTEGER,
        duration INTEGER,
        recurrence_rule TEXT,
        priority INTEGER DEFAULT 4,
        completed INTEGER DEFAULT 0,
        completed_at INTEGER,
        sort_order REAL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )
    `)

    db.run(`
      CREATE TABLE comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `)

    // Create a task to attach comments to
    const now = Date.now()
    taskId = 'task-1'
    db.run(
      `INSERT INTO tasks (id, content, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [taskId, 'Test task', 4, now, now]
    )

    commentRepo = new CommentRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('create', () => {
    it('should create a comment', () => {
      const comment = commentRepo.create({
        taskId,
        content: 'This is a comment'
      })

      expect(comment).toBeDefined()
      expect(comment.id).toBeDefined()
      expect(comment.taskId).toBe(taskId)
      expect(comment.content).toBe('This is a comment')
      expect(comment.createdAt).toBeDefined()
      expect(comment.updatedAt).toBeDefined()
    })

    it('should create multiple comments for the same task', () => {
      const comment1 = commentRepo.create({ taskId, content: 'Comment 1' })
      const comment2 = commentRepo.create({ taskId, content: 'Comment 2' })
      const comment3 = commentRepo.create({ taskId, content: 'Comment 3' })

      expect(comment1.id).not.toBe(comment2.id)
      expect(comment2.id).not.toBe(comment3.id)

      const comments = commentRepo.list(taskId)
      expect(comments.length).toBe(3)
    })
  })

  describe('get', () => {
    it('should get a comment by id', () => {
      const created = commentRepo.create({ taskId, content: 'Test comment' })
      const fetched = commentRepo.get(created.id)

      expect(fetched).toBeDefined()
      expect(fetched?.id).toBe(created.id)
      expect(fetched?.content).toBe('Test comment')
    })

    it('should return null for non-existent comment', () => {
      const fetched = commentRepo.get('non-existent')
      expect(fetched).toBeNull()
    })
  })

  describe('list', () => {
    it('should list all comments for a task', () => {
      commentRepo.create({ taskId, content: 'Comment 1' })
      commentRepo.create({ taskId, content: 'Comment 2' })

      const comments = commentRepo.list(taskId)

      expect(comments.length).toBe(2)
      expect(comments[0].content).toBe('Comment 1')
      expect(comments[1].content).toBe('Comment 2')
    })

    it('should return empty array for task with no comments', () => {
      const comments = commentRepo.list(taskId)
      expect(comments).toEqual([])
    })

    it('should order comments by creation date', () => {
      const c1 = commentRepo.create({ taskId, content: 'First' })
      const c2 = commentRepo.create({ taskId, content: 'Second' })
      const c3 = commentRepo.create({ taskId, content: 'Third' })

      const comments = commentRepo.list(taskId)

      expect(comments[0].id).toBe(c1.id)
      expect(comments[2].id).toBe(c3.id)
    })
  })

  describe('update', () => {
    it('should update a comment content', () => {
      const comment = commentRepo.create({ taskId, content: 'Original' })
      const updated = commentRepo.update(comment.id, { content: 'Updated' })

      expect(updated.content).toBe('Updated')
      expect(updated.updatedAt).toBeGreaterThanOrEqual(comment.updatedAt)
    })

    it('should not update other fields when updating content', () => {
      const comment = commentRepo.create({ taskId, content: 'Original' })
      const updated = commentRepo.update(comment.id, { content: 'Updated' })

      expect(updated.taskId).toBe(comment.taskId)
      expect(updated.createdAt).toBe(comment.createdAt)
    })
  })

  describe('delete', () => {
    it('should delete a comment', () => {
      const comment = commentRepo.create({ taskId, content: 'To delete' })
      commentRepo.delete(comment.id)

      const fetched = commentRepo.get(comment.id)
      expect(fetched).toBeNull()
    })

    it('should not affect other comments when deleting one', () => {
      const comment1 = commentRepo.create({ taskId, content: 'Keep' })
      const comment2 = commentRepo.create({ taskId, content: 'Delete' })

      commentRepo.delete(comment2.id)

      const comments = commentRepo.list(taskId)
      expect(comments.length).toBe(1)
      expect(comments[0].id).toBe(comment1.id)
    })
  })

  describe('deleteByTask', () => {
    it('should delete all comments for a task', () => {
      commentRepo.create({ taskId, content: 'Comment 1' })
      commentRepo.create({ taskId, content: 'Comment 2' })
      commentRepo.create({ taskId, content: 'Comment 3' })

      commentRepo.deleteByTask(taskId)

      const comments = commentRepo.list(taskId)
      expect(comments.length).toBe(0)
    })
  })

  describe('count', () => {
    it('should count comments for a task', () => {
      expect(commentRepo.count(taskId)).toBe(0)

      commentRepo.create({ taskId, content: 'Comment 1' })
      expect(commentRepo.count(taskId)).toBe(1)

      commentRepo.create({ taskId, content: 'Comment 2' })
      expect(commentRepo.count(taskId)).toBe(2)
    })
  })
})

// Types
interface Comment {
  id: string
  taskId: string
  content: string
  createdAt: number
  updatedAt: number
}

interface CommentCreate {
  taskId: string
  content: string
}

interface CommentUpdate {
  content: string
}

// Implementation
class CommentRepository {
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
