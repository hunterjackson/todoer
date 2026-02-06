import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDatabase } from '@main/db'
import { TaskRepository } from '@main/db/repositories/taskRepository'
import { createAttachmentRepository } from '@main/db/repositories/attachmentRepository'
import { importTaskAttachments } from '@main/services/attachmentImport'
import type { ExportAttachment } from '@main/services/dataExport'
import { Database as SqlJsDatabase } from 'sql.js'

describe('attachmentImport service', () => {
  let db: SqlJsDatabase
  let taskRepo: TaskRepository

  beforeEach(async () => {
    db = await createTestDatabase()
    taskRepo = new TaskRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('imports attachments even when original IDs already exist in target DB', () => {
    const task = taskRepo.create({ content: 'Target task' })
    const repo = createAttachmentRepository(db)

    repo.addWithMetadata(
      'existing-attachment-id',
      task.id,
      'existing.txt',
      'text/plain',
      Buffer.from('existing'),
      Date.now() - 1000
    )

    const attachments: ExportAttachment[] = [
      {
        id: 'existing-attachment-id',
        taskId: 'old-task-id',
        filename: 'imported.txt',
        mimeType: 'text/plain',
        size: 8,
        createdAt: Date.now(),
        dataBase64: Buffer.from('imported').toString('base64')
      }
    ]

    const importedCount = importTaskAttachments(db, attachments, new Map([['old-task-id', task.id]]))
    const list = repo.listByTask(task.id)

    expect(importedCount).toBe(1)
    expect(list).toHaveLength(2)
    expect(list.some((attachment) => attachment.filename === 'imported.txt')).toBe(true)
  })

  it('counts only attachments that can be mapped to imported tasks', () => {
    const attachments: ExportAttachment[] = [
      {
        id: 'unmapped-id',
        taskId: 'missing-task',
        filename: 'skip.txt',
        mimeType: 'text/plain',
        size: 4,
        createdAt: Date.now(),
        dataBase64: Buffer.from('skip').toString('base64')
      }
    ]

    const importedCount = importTaskAttachments(db, attachments, new Map())
    expect(importedCount).toBe(0)
  })
})
