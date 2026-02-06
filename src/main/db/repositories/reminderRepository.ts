import type { Database } from 'sql.js'
import type { Reminder } from '@shared/types'
import { saveDatabase } from '../index'

interface ReminderCreate {
  taskId: string
  remindAt: number
}

export class ReminderRepository {
  constructor(private db: Database) {}

  private run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params)
    saveDatabase()
  }

  create(data: ReminderCreate): Reminder {
    const id = `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    this.run(
      `INSERT INTO reminders (id, task_id, remind_at, notified) VALUES (?, ?, ?, 0)`,
      [id, data.taskId, data.remindAt]
    )

    return this.get(id)!
  }

  get(id: string): Reminder | null {
    const stmt = this.db.prepare('SELECT * FROM reminders WHERE id = ?')
    stmt.bind([id])

    if (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string
        task_id: string
        remind_at: number
        notified: number
      }
      stmt.free()
      return {
        id: row.id,
        taskId: row.task_id,
        remindAt: row.remind_at,
        notified: row.notified === 1
      }
    }

    stmt.free()
    return null
  }

  listAll(): Reminder[] {
    const stmt = this.db.prepare(
      'SELECT * FROM reminders ORDER BY remind_at ASC'
    )

    const reminders: Reminder[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string
        task_id: string
        remind_at: number
        notified: number
      }
      reminders.push({
        id: row.id,
        taskId: row.task_id,
        remindAt: row.remind_at,
        notified: row.notified === 1
      })
    }
    stmt.free()

    return reminders
  }

  getByTask(taskId: string): Reminder[] {
    const stmt = this.db.prepare(
      'SELECT * FROM reminders WHERE task_id = ? ORDER BY remind_at ASC'
    )
    stmt.bind([taskId])

    const reminders: Reminder[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string
        task_id: string
        remind_at: number
        notified: number
      }
      reminders.push({
        id: row.id,
        taskId: row.task_id,
        remindAt: row.remind_at,
        notified: row.notified === 1
      })
    }
    stmt.free()

    return reminders
  }

  getDue(): Reminder[] {
    const now = Date.now()
    const stmt = this.db.prepare(
      'SELECT * FROM reminders WHERE notified = 0 AND remind_at <= ? ORDER BY remind_at ASC'
    )
    stmt.bind([now])

    const reminders: Reminder[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string
        task_id: string
        remind_at: number
        notified: number
      }
      reminders.push({
        id: row.id,
        taskId: row.task_id,
        remindAt: row.remind_at,
        notified: false
      })
    }
    stmt.free()

    return reminders
  }

  getUpcoming(withinMs: number = 3600000): Reminder[] {
    const now = Date.now()
    const until = now + withinMs
    const stmt = this.db.prepare(
      'SELECT * FROM reminders WHERE notified = 0 AND remind_at > ? AND remind_at <= ? ORDER BY remind_at ASC'
    )
    stmt.bind([now, until])

    const reminders: Reminder[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string
        task_id: string
        remind_at: number
        notified: number
      }
      reminders.push({
        id: row.id,
        taskId: row.task_id,
        remindAt: row.remind_at,
        notified: false
      })
    }
    stmt.free()

    return reminders
  }

  markNotified(id: string): void {
    this.run('UPDATE reminders SET notified = 1 WHERE id = ?', [id])
  }

  delete(id: string): void {
    this.run('DELETE FROM reminders WHERE id = ?', [id])
  }

  deleteByTask(taskId: string): void {
    this.run('DELETE FROM reminders WHERE task_id = ?', [taskId])
  }
}
