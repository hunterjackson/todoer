import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'
import { DEFAULT_SETTINGS, INBOX_PROJECT_ID } from '@shared/constants'

/**
 * Tests for settings storage using the same SQL patterns as the IPC handlers
 * in src/main/ipc/handlers.ts (settings:get, settings:set).
 *
 * NOTE: Settings logic is inline in handlers.ts (no separate SettingsService class),
 * so these tests use helper functions that mirror the exact SQL queries from the
 * handlers. This is intentional - extracting a SettingsService would be the ideal
 * fix but is beyond the scope of a code review pass.
 */

// These helper functions mirror the exact SQL used in handlers.ts
function settingsGet(db: Database, key: string): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  stmt.bind([key])
  if (stmt.step()) {
    const result = stmt.getAsObject() as { value: string }
    stmt.free()
    return result.value
  }
  stmt.free()
  return null
}

function settingsSet(db: Database, key: string, value: string): void {
  db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  )
}

function settingsDelete(db: Database, key: string): void {
  db.run('DELETE FROM settings WHERE key = ?', [key])
}

function settingsGetAll(db: Database): Record<string, string> {
  const result = db.exec('SELECT key, value FROM settings')
  if (result.length === 0) return {}
  const settings: Record<string, string> = {}
  for (const row of result[0].values) {
    settings[row[0] as string] = row[1] as string
  }
  return settings
}

describe('Settings Service', () => {
  let db: Database

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()

    db.run(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
  })

  afterEach(() => {
    db.close()
  })

  describe('get', () => {
    it('should return null for non-existent key', () => {
      const value = settingsGet(db, 'nonexistent')
      expect(value).toBeNull()
    })

    it('should return value for existing key', () => {
      db.run(`INSERT INTO settings (key, value) VALUES ('theme', 'dark')`)
      const value = settingsGet(db, 'theme')
      expect(value).toBe('dark')
    })
  })

  describe('set', () => {
    it('should create a new setting', () => {
      settingsSet(db, 'theme', 'dark')
      const value = settingsGet(db, 'theme')
      expect(value).toBe('dark')
    })

    it('should update an existing setting', () => {
      settingsSet(db, 'theme', 'light')
      settingsSet(db, 'theme', 'dark')
      const value = settingsGet(db, 'theme')
      expect(value).toBe('dark')
    })

    it('should handle JSON values', () => {
      const config = { showCompleted: true, defaultView: 'today' }
      settingsSet(db, 'uiConfig', JSON.stringify(config))
      const value = settingsGet(db, 'uiConfig')
      expect(JSON.parse(value!)).toEqual(config)
    })
  })

  describe('delete', () => {
    it('should delete a setting', () => {
      settingsSet(db, 'theme', 'dark')
      settingsDelete(db, 'theme')
      const value = settingsGet(db, 'theme')
      expect(value).toBeNull()
    })

    it('should not throw for non-existent key', () => {
      expect(() => settingsDelete(db, 'nonexistent')).not.toThrow()
    })
  })

  describe('getAll', () => {
    it('should return empty object when no settings', () => {
      const settings = settingsGetAll(db)
      expect(settings).toEqual({})
    })

    it('should return all settings', () => {
      settingsSet(db, 'theme', 'dark')
      settingsSet(db, 'language', 'en')
      settingsSet(db, 'sidebarWidth', '250')

      const settings = settingsGetAll(db)

      expect(settings).toEqual({
        theme: 'dark',
        language: 'en',
        sidebarWidth: '250'
      })
    })
  })

  describe('Default Settings', () => {
    it('should have all keys matching AppSettings interface', () => {
      // DEFAULT_SETTINGS must define every key from the runtime AppSettings contract
      const expectedKeys = [
        'confirmDelete',
        'weekStart',
        'timeFormat',
        'dateFormat',
        'notificationsEnabled',
        'dailyGoal',
        'weeklyGoal',
        'quietHoursStart',
        'quietHoursEnd',
        'defaultProject',
        'keyboardShortcuts'
      ]
      for (const key of expectedKeys) {
        expect(DEFAULT_SETTINGS).toHaveProperty(key)
      }
      // Should not have extra stale keys
      expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(expectedKeys.sort())
    })

    it('should use correct types and values', () => {
      expect(DEFAULT_SETTINGS.confirmDelete).toBe(true)
      expect(DEFAULT_SETTINGS.weekStart).toBe(0)
      expect(['12h', '24h']).toContain(DEFAULT_SETTINGS.timeFormat)
      expect(['mdy', 'dmy', 'ymd']).toContain(DEFAULT_SETTINGS.dateFormat)
      expect(typeof DEFAULT_SETTINGS.notificationsEnabled).toBe('boolean')
      expect(typeof DEFAULT_SETTINGS.dailyGoal).toBe('number')
      expect(typeof DEFAULT_SETTINGS.weeklyGoal).toBe('number')
      expect(typeof DEFAULT_SETTINGS.quietHoursStart).toBe('number')
      expect(typeof DEFAULT_SETTINGS.quietHoursEnd).toBe('number')
      expect(DEFAULT_SETTINGS.defaultProject).toBe(INBOX_PROJECT_ID)
    })
  })
})
