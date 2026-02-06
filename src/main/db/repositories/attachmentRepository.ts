import { generateId } from '@shared/utils'
import type { Database as SqlJsDatabase } from 'sql.js'
import { saveDatabase } from '../index'

export interface TaskAttachment {
  id: string
  taskId: string
  filename: string
  mimeType: string
  size: number
  createdAt: number
  // data is not included in list responses for performance
}

export interface TaskAttachmentWithData extends TaskAttachment {
  data: Buffer
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB per task

export function createAttachmentRepository(db: SqlJsDatabase) {
  function run(sql: string, params: unknown[] = []): void {
    db.run(sql, params)
    saveDatabase()
  }

  return {
    listByTask(taskId: string): TaskAttachment[] {
      const result = db.exec(
        `SELECT id, task_id, filename, mime_type, size, created_at
         FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC`,
        [taskId]
      )
      if (result.length === 0) return []
      return result[0].values.map((row) => ({
        id: row[0] as string,
        taskId: row[1] as string,
        filename: row[2] as string,
        mimeType: row[3] as string,
        size: row[4] as number,
        createdAt: row[5] as number
      }))
    },

    get(id: string): TaskAttachmentWithData | null {
      const result = db.exec(
        `SELECT id, task_id, filename, mime_type, size, data, created_at
         FROM task_attachments WHERE id = ?`,
        [id]
      )
      if (result.length === 0 || result[0].values.length === 0) return null
      const row = result[0].values[0]
      return {
        id: row[0] as string,
        taskId: row[1] as string,
        filename: row[2] as string,
        mimeType: row[3] as string,
        size: row[4] as number,
        data: Buffer.from(row[5] as Uint8Array),
        createdAt: row[6] as number
      }
    },

    add(taskId: string, filename: string, mimeType: string, data: Buffer): TaskAttachment {
      // Check file size
      if (data.length > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
      }

      // Check total size for this task
      const totalResult = db.exec(
        'SELECT COALESCE(SUM(size), 0) FROM task_attachments WHERE task_id = ?',
        [taskId]
      )
      const currentTotal = totalResult.length > 0 ? (totalResult[0].values[0][0] as number) : 0
      if (currentTotal + data.length > MAX_TOTAL_SIZE) {
        throw new Error(`Total attachment size for this task would exceed ${MAX_TOTAL_SIZE / 1024 / 1024}MB`)
      }

      const id = generateId()
      const now = Date.now()

      run(
        `INSERT INTO task_attachments (id, task_id, filename, mime_type, size, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, taskId, filename, mimeType, data.length, data, now]
      )

      return { id, taskId, filename, mimeType, size: data.length, createdAt: now }
    },

    addWithMetadata(id: string, taskId: string, filename: string, mimeType: string, data: Buffer, createdAt: number): TaskAttachment {
      run(
        `INSERT OR IGNORE INTO task_attachments (id, task_id, filename, mime_type, size, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, taskId, filename, mimeType, data.length, data, createdAt]
      )
      return { id, taskId, filename, mimeType, size: data.length, createdAt }
    },

    delete(id: string): boolean {
      run('DELETE FROM task_attachments WHERE id = ?', [id])
      return true
    },

    listAllWithData(): TaskAttachmentWithData[] {
      const result = db.exec(
        `SELECT id, task_id, filename, mime_type, size, data, created_at
         FROM task_attachments ORDER BY created_at`
      )
      if (result.length === 0) return []
      return result[0].values.map((row) => ({
        id: row[0] as string,
        taskId: row[1] as string,
        filename: row[2] as string,
        mimeType: row[3] as string,
        size: row[4] as number,
        data: Buffer.from(row[5] as Uint8Array),
        createdAt: row[6] as number
      }))
    },

    count(taskId: string): number {
      const result = db.exec(
        'SELECT COUNT(*) FROM task_attachments WHERE task_id = ?',
        [taskId]
      )
      return result.length > 0 ? (result[0].values[0][0] as number) : 0
    }
  }
}
