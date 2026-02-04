import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'

// Settings service tests
describe('Settings Service', () => {
  let db: Database
  let settingsService: SettingsService

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()

    db.run(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    settingsService = new SettingsService(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('get', () => {
    it('should return null for non-existent key', () => {
      const value = settingsService.get('nonexistent')
      expect(value).toBeNull()
    })

    it('should return value for existing key', () => {
      db.run(`INSERT INTO settings (key, value) VALUES ('theme', 'dark')`)
      const value = settingsService.get('theme')
      expect(value).toBe('dark')
    })
  })

  describe('set', () => {
    it('should create a new setting', () => {
      settingsService.set('theme', 'dark')
      const value = settingsService.get('theme')
      expect(value).toBe('dark')
    })

    it('should update an existing setting', () => {
      settingsService.set('theme', 'light')
      settingsService.set('theme', 'dark')
      const value = settingsService.get('theme')
      expect(value).toBe('dark')
    })

    it('should handle JSON values', () => {
      const config = { showCompleted: true, defaultView: 'today' }
      settingsService.set('uiConfig', JSON.stringify(config))
      const value = settingsService.get('uiConfig')
      expect(JSON.parse(value!)).toEqual(config)
    })
  })

  describe('delete', () => {
    it('should delete a setting', () => {
      settingsService.set('theme', 'dark')
      settingsService.delete('theme')
      const value = settingsService.get('theme')
      expect(value).toBeNull()
    })

    it('should not throw for non-existent key', () => {
      expect(() => settingsService.delete('nonexistent')).not.toThrow()
    })
  })

  describe('getAll', () => {
    it('should return empty object when no settings', () => {
      const settings = settingsService.getAll()
      expect(settings).toEqual({})
    })

    it('should return all settings', () => {
      settingsService.set('theme', 'dark')
      settingsService.set('language', 'en')
      settingsService.set('sidebarWidth', '250')

      const settings = settingsService.getAll()

      expect(settings).toEqual({
        theme: 'dark',
        language: 'en',
        sidebarWidth: '250'
      })
    })
  })

  describe('getWithDefault', () => {
    it('should return default for non-existent key', () => {
      const value = settingsService.getWithDefault('theme', 'system')
      expect(value).toBe('system')
    })

    it('should return actual value if exists', () => {
      settingsService.set('theme', 'dark')
      const value = settingsService.getWithDefault('theme', 'system')
      expect(value).toBe('dark')
    })
  })

  describe('Default Settings', () => {
    it('should define all default settings', () => {
      expect(DEFAULT_SETTINGS.theme).toBeDefined()
      expect(DEFAULT_SETTINGS.dailyGoal).toBeDefined()
      expect(DEFAULT_SETTINGS.weekStart).toBeDefined()
      expect(DEFAULT_SETTINGS.showCompletedTasks).toBeDefined()
    })
  })
})

// Default settings
const DEFAULT_SETTINGS = {
  theme: 'system',
  dailyGoal: 5,
  weekStart: 0, // Sunday
  showCompletedTasks: true,
  confirmDelete: true,
  soundEnabled: true,
  notificationsEnabled: true,
  language: 'en',
  dateFormat: 'relative', // 'relative' | 'absolute'
  timeFormat: '12h' // '12h' | '24h'
}

// Implementation
class SettingsService {
  constructor(private db: Database) {}

  get(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?')
    stmt.bind([key])

    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string }
      stmt.free()
      return row.value
    }

    stmt.free()
    return null
  }

  set(key: string, value: string): void {
    // Check if exists
    const stmt = this.db.prepare('SELECT key FROM settings WHERE key = ?')
    stmt.bind([key])
    const exists = stmt.step()
    stmt.free()

    if (exists) {
      this.db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key])
    } else {
      this.db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value])
    }
  }

  delete(key: string): void {
    this.db.run('DELETE FROM settings WHERE key = ?', [key])
  }

  getAll(): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}

    while (stmt.step()) {
      const row = stmt.getAsObject() as { key: string; value: string }
      settings[row.key] = row.value
    }

    stmt.free()
    return settings
  }

  getWithDefault(key: string, defaultValue: string): string {
    const value = this.get(key)
    return value ?? defaultValue
  }
}
