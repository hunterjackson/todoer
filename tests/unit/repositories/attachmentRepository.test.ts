import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { createAttachmentRepository } from '../../../src/main/db/repositories/attachmentRepository'

let db: SqlJsDatabase

beforeAll(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
})

beforeEach(() => {
  // Create tables fresh
  db.run('DROP TABLE IF EXISTS task_attachments')
  db.run('DROP TABLE IF EXISTS tasks')
  db.run(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      project_id TEXT,
      created_at INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE task_attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)
  // Create a test task
  db.run(`INSERT INTO tasks (id, content, created_at) VALUES ('task-1', 'Test task', ${Date.now()})`)
})

describe('Attachment Repository', () => {
  it('should add an attachment to a task', () => {
    const repo = createAttachmentRepository(db)
    const data = Buffer.from('Hello, World!')
    const result = repo.add('task-1', 'test.txt', 'text/plain', data)

    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    expect(result.taskId).toBe('task-1')
    expect(result.filename).toBe('test.txt')
    expect(result.mimeType).toBe('text/plain')
    expect(result.size).toBe(13)
  })

  it('should list attachments for a task', () => {
    const repo = createAttachmentRepository(db)
    repo.add('task-1', 'file1.txt', 'text/plain', Buffer.from('content1'))
    repo.add('task-1', 'file2.pdf', 'application/pdf', Buffer.from('content2'))

    const list = repo.listByTask('task-1')
    expect(list).toHaveLength(2)
    expect(list[0].filename).toBeDefined()
    expect(list[1].filename).toBeDefined()
    // Should not include data in list results
    expect((list[0] as any).data).toBeUndefined()
  })

  it('should get attachment with data', () => {
    const repo = createAttachmentRepository(db)
    const original = Buffer.from('Hello, World!')
    const added = repo.add('task-1', 'test.txt', 'text/plain', original)

    const retrieved = repo.get(added.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.filename).toBe('test.txt')
    expect(retrieved!.data).toBeDefined()
    expect(retrieved!.data.toString()).toBe('Hello, World!')
  })

  it('should delete an attachment', () => {
    const repo = createAttachmentRepository(db)
    const added = repo.add('task-1', 'test.txt', 'text/plain', Buffer.from('content'))

    repo.delete(added.id)
    expect(repo.listByTask('task-1')).toHaveLength(0)
  })

  it('should count attachments for a task', () => {
    const repo = createAttachmentRepository(db)
    expect(repo.count('task-1')).toBe(0)

    repo.add('task-1', 'file1.txt', 'text/plain', Buffer.from('a'))
    repo.add('task-1', 'file2.txt', 'text/plain', Buffer.from('b'))
    expect(repo.count('task-1')).toBe(2)
  })

  it('should reject files over 10MB', () => {
    const repo = createAttachmentRepository(db)
    const bigData = Buffer.alloc(11 * 1024 * 1024) // 11MB

    expect(() => repo.add('task-1', 'big.bin', 'application/octet-stream', bigData))
      .toThrow('File too large')
  })

  it('should reject when total attachments exceed 50MB', () => {
    const repo = createAttachmentRepository(db)

    // Add 5 files of ~9MB each (45MB total)
    for (let i = 0; i < 5; i++) {
      repo.add('task-1', `file${i}.bin`, 'application/octet-stream', Buffer.alloc(9 * 1024 * 1024))
    }

    // The next 9MB file should fail (would be 54MB total)
    expect(() => repo.add('task-1', 'overflow.bin', 'application/octet-stream', Buffer.alloc(9 * 1024 * 1024)))
      .toThrow('Total attachment size')
  })

  it('should return null for non-existent attachment', () => {
    const repo = createAttachmentRepository(db)
    expect(repo.get('nonexistent')).toBeNull()
  })

  it('should return empty list for task with no attachments', () => {
    const repo = createAttachmentRepository(db)
    expect(repo.listByTask('task-1')).toHaveLength(0)
  })

  it('should only list attachments for the specified task', () => {
    db.run(`INSERT INTO tasks (id, content, created_at) VALUES ('task-2', 'Second task', ${Date.now()})`)
    const repo = createAttachmentRepository(db)

    repo.add('task-1', 'file1.txt', 'text/plain', Buffer.from('a'))
    repo.add('task-2', 'file2.txt', 'text/plain', Buffer.from('b'))

    expect(repo.listByTask('task-1')).toHaveLength(1)
    expect(repo.listByTask('task-2')).toHaveLength(1)
  })

  it('should preserve original id and createdAt with addWithMetadata', () => {
    const repo = createAttachmentRepository(db)
    const originalId = 'original-attachment-id'
    const originalCreatedAt = 1700000000000

    const result = repo.addWithMetadata(
      originalId,
      'task-1',
      'preserved.txt',
      'text/plain',
      Buffer.from('hello'),
      originalCreatedAt
    )

    expect(result.id).toBe(originalId)
    expect(result.createdAt).toBe(originalCreatedAt)
    expect(result.filename).toBe('preserved.txt')

    // Verify by listing
    const list = repo.listByTask('task-1')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(originalId)
  })

  it('addWithMetadata should reject files over 10MB', () => {
    const repo = createAttachmentRepository(db)
    const bigData = Buffer.alloc(11 * 1024 * 1024)

    expect(() => repo.addWithMetadata('big-id', 'task-1', 'big.bin', 'application/octet-stream', bigData, Date.now()))
      .toThrow('File too large')
  })

  it('addWithMetadata should reject when total attachments exceed 50MB', () => {
    const repo = createAttachmentRepository(db)

    for (let i = 0; i < 5; i++) {
      repo.addWithMetadata(`meta-${i}`, 'task-1', `file${i}.bin`, 'application/octet-stream', Buffer.alloc(9 * 1024 * 1024), Date.now())
    }

    expect(() => repo.addWithMetadata('overflow-id', 'task-1', 'overflow.bin', 'application/octet-stream', Buffer.alloc(9 * 1024 * 1024), Date.now()))
      .toThrow('Total attachment size')
  })

  it('addWithMetadata should skip duplicate IDs (INSERT OR IGNORE)', () => {
    const repo = createAttachmentRepository(db)

    repo.addWithMetadata('same-id', 'task-1', 'first.txt', 'text/plain', Buffer.from('a'), 1700000000000)
    repo.addWithMetadata('same-id', 'task-1', 'second.txt', 'text/plain', Buffer.from('b'), 1700000000001)

    const list = repo.listByTask('task-1')
    expect(list).toHaveLength(1)
    expect(list[0].filename).toBe('first.txt')
  })
})
