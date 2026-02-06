import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'
import { CommentRepository } from '../../../src/main/db/repositories/commentRepository'

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
        task_id TEXT,
        project_id TEXT,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (task_id IS NOT NULL OR project_id IS NOT NULL)
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

    it('should sanitize HTML content on create', () => {
      const comment = commentRepo.create({
        taskId,
        content: '<p>Hello</p><script>alert(1)</script>'
      })

      expect(comment.content).toBe('<p>Hello</p>')
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

    it('should sanitize HTML content on update', () => {
      const comment = commentRepo.create({ taskId, content: 'Original' })
      const updated = commentRepo.update(comment.id, {
        content: '<a href=javascript:alert(1)>Click</a>'
      })

      expect(updated.content).toBe('<a href="">Click</a>')
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
