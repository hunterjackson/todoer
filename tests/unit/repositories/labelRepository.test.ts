import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'
import { LabelRepository } from '../../../src/main/db/repositories/labelRepository'

describe('LabelRepository', () => {
  let db: Database
  let labelRepo: LabelRepository

  const createDb = async () => {
    const SQL = await initSqlJs()
    return new SQL.Database()
  }

  beforeEach(async () => {
    db = await createDb()

    // Create tables
    db.run(`
      CREATE TABLE labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#808080',
        sort_order REAL DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `)

    db.run(`
      CREATE TABLE task_labels (
        task_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        PRIMARY KEY (task_id, label_id)
      )
    `)

    labelRepo = new LabelRepository(db)
  })

  describe('create', () => {
    it('should create a label with default values', () => {
      const label = labelRepo.create({ name: 'Work' })

      expect(label.id).toBeDefined()
      expect(label.name).toBe('Work')
      expect(label.color).toBe('#808080')
      expect(label.isFavorite).toBe(false)
    })

    it('should create a label with custom color', () => {
      const label = labelRepo.create({ name: 'Urgent', color: '#ff0000' })

      expect(label.color).toBe('#ff0000')
    })

    it('should create a favorite label', () => {
      const label = labelRepo.create({ name: 'Important', isFavorite: true })

      expect(label.isFavorite).toBe(true)
    })

    it('should auto-assign sort order', () => {
      const label1 = labelRepo.create({ name: 'First' })
      const label2 = labelRepo.create({ name: 'Second' })

      expect(label2.sortOrder).toBeGreaterThan(label1.sortOrder)
    })
  })

  describe('get', () => {
    it('should get a label by ID', () => {
      const created = labelRepo.create({ name: 'Work' })

      const retrieved = labelRepo.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe('Work')
    })

    it('should return null for non-existent label', () => {
      const result = labelRepo.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('getByName', () => {
    it('should get a label by name', () => {
      labelRepo.create({ name: 'Work' })

      const retrieved = labelRepo.getByName('Work')

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Work')
    })

    it('should return null for non-existent name', () => {
      const result = labelRepo.getByName('NonExistent')
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('should list all labels', () => {
      labelRepo.create({ name: 'Work' })
      labelRepo.create({ name: 'Personal' })

      const labels = labelRepo.list()

      expect(labels).toHaveLength(2)
    })

    it('should return empty array when no labels', () => {
      const labels = labelRepo.list()
      expect(labels).toHaveLength(0)
    })

    it('should order labels by sort_order', () => {
      const l1 = labelRepo.create({ name: 'First' })
      const l2 = labelRepo.create({ name: 'Second' })

      // Manually reorder
      labelRepo.reorder(l2.id, 0.5)
      labelRepo.reorder(l1.id, 1)

      const labels = labelRepo.list()
      expect(labels[0].name).toBe('Second')
      expect(labels[1].name).toBe('First')
    })
  })

  describe('update', () => {
    it('should update label name', () => {
      const label = labelRepo.create({ name: 'Old Name' })

      const updated = labelRepo.update(label.id, { name: 'New Name' })

      expect(updated?.name).toBe('New Name')
    })

    it('should update label color', () => {
      const label = labelRepo.create({ name: 'Test' })

      const updated = labelRepo.update(label.id, { color: '#0000ff' })

      expect(updated?.color).toBe('#0000ff')
    })

    it('should update isFavorite', () => {
      const label = labelRepo.create({ name: 'Test' })

      expect(label.isFavorite).toBe(false)

      const updated = labelRepo.update(label.id, { isFavorite: true })

      expect(updated?.isFavorite).toBe(true)
    })

    it('should return null for non-existent label', () => {
      const result = labelRepo.update('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should handle update with no changes', () => {
      const label = labelRepo.create({ name: 'Test' })

      const updated = labelRepo.update(label.id, {})

      expect(updated?.name).toBe('Test')
    })
  })

  describe('delete', () => {
    it('should delete a label', () => {
      const label = labelRepo.create({ name: 'Test' })

      const result = labelRepo.delete(label.id)

      expect(result).toBe(true)
      expect(labelRepo.get(label.id)).toBeNull()
    })

    it('should return false for non-existent label', () => {
      const result = labelRepo.delete('non-existent')
      expect(result).toBe(false)
    })

    it('should remove label from task_labels', () => {
      const label = labelRepo.create({ name: 'Test' })

      // Manually add a task_label relationship
      db.run('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', [
        'task-1',
        label.id
      ])

      // Verify it exists
      const before = db
        .exec('SELECT * FROM task_labels WHERE label_id = ?', [label.id])
        .map((r) => r.values)
      expect(before[0]).toHaveLength(1)

      labelRepo.delete(label.id)

      // Verify it's gone
      const after = db.exec('SELECT * FROM task_labels WHERE label_id = ?', [
        label.id
      ])
      expect(after).toHaveLength(0)
    })
  })

  describe('getTaskCount', () => {
    beforeEach(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          deleted_at INTEGER
        )
      `)
    })

    it('should return 0 for label with no tasks', () => {
      const label = labelRepo.create({ name: 'Empty' })
      expect(labelRepo.getTaskCount(label.id)).toBe(0)
    })

    it('should count tasks using the label', () => {
      const label = labelRepo.create({ name: 'Work' })
      db.run("INSERT INTO tasks (id, content, deleted_at) VALUES ('t1', 'Task 1', NULL)")
      db.run("INSERT INTO tasks (id, content, deleted_at) VALUES ('t2', 'Task 2', NULL)")
      db.run('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', ['t1', label.id])
      db.run('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', ['t2', label.id])
      expect(labelRepo.getTaskCount(label.id)).toBe(2)
    })

    it('should exclude soft-deleted tasks', () => {
      const label = labelRepo.create({ name: 'Work' })
      db.run("INSERT INTO tasks (id, content, deleted_at) VALUES ('t1', 'Active', NULL)")
      db.run("INSERT INTO tasks (id, content, deleted_at) VALUES ('t2', 'Deleted', 1234567890)")
      db.run('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', ['t1', label.id])
      db.run('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', ['t2', label.id])
      expect(labelRepo.getTaskCount(label.id)).toBe(1)
    })
  })

  describe('reorder', () => {
    it('should update sort order', () => {
      const label = labelRepo.create({ name: 'Test' })

      const updated = labelRepo.reorder(label.id, 5.5)

      expect(updated?.sortOrder).toBe(5.5)
    })

    it('should return null for non-existent label', () => {
      const result = labelRepo.reorder('non-existent', 5)
      expect(result).toBeNull()
    })
  })
})
