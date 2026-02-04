import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs, { Database } from 'sql.js'
import { FilterRepository } from '../../../src/main/db/repositories/filterRepository'

describe('FilterRepository', () => {
  let db: Database
  let filterRepo: FilterRepository

  const createDb = async () => {
    const SQL = await initSqlJs()
    return new SQL.Database()
  }

  beforeEach(async () => {
    db = await createDb()

    // Create table
    db.run(`
      CREATE TABLE filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        color TEXT DEFAULT '#808080',
        sort_order REAL DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `)

    filterRepo = new FilterRepository(db)
  })

  describe('create', () => {
    it('should create a filter with default values', () => {
      const filter = filterRepo.create({
        name: 'High Priority',
        query: 'priority:1'
      })

      expect(filter.id).toBeDefined()
      expect(filter.name).toBe('High Priority')
      expect(filter.query).toBe('priority:1')
      expect(filter.color).toBe('#808080')
      expect(filter.isFavorite).toBe(false)
    })

    it('should create a filter with custom color', () => {
      const filter = filterRepo.create({
        name: 'Urgent',
        query: 'priority:1',
        color: '#ff0000'
      })

      expect(filter.color).toBe('#ff0000')
    })

    it('should create a favorite filter', () => {
      const filter = filterRepo.create({
        name: 'Important',
        query: 'priority:1 | priority:2',
        isFavorite: true
      })

      expect(filter.isFavorite).toBe(true)
    })

    it('should auto-assign sort order', () => {
      const filter1 = filterRepo.create({ name: 'First', query: 'a' })
      const filter2 = filterRepo.create({ name: 'Second', query: 'b' })

      expect(filter2.sortOrder).toBeGreaterThan(filter1.sortOrder)
    })
  })

  describe('get', () => {
    it('should get a filter by ID', () => {
      const created = filterRepo.create({ name: 'Test', query: 'priority:1' })

      const retrieved = filterRepo.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe('Test')
      expect(retrieved?.query).toBe('priority:1')
    })

    it('should return null for non-existent filter', () => {
      const result = filterRepo.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('should list all filters', () => {
      filterRepo.create({ name: 'Filter 1', query: 'a' })
      filterRepo.create({ name: 'Filter 2', query: 'b' })

      const filters = filterRepo.list()

      expect(filters).toHaveLength(2)
    })

    it('should return empty array when no filters', () => {
      const filters = filterRepo.list()
      expect(filters).toHaveLength(0)
    })

    it('should order filters by sort_order', () => {
      const f1 = filterRepo.create({ name: 'First', query: 'a' })
      const f2 = filterRepo.create({ name: 'Second', query: 'b' })

      // Manually reorder
      filterRepo.reorder(f2.id, 0.5)
      filterRepo.reorder(f1.id, 1)

      const filters = filterRepo.list()
      expect(filters[0].name).toBe('Second')
      expect(filters[1].name).toBe('First')
    })
  })

  describe('update', () => {
    it('should update filter name', () => {
      const filter = filterRepo.create({ name: 'Old Name', query: 'test' })

      const updated = filterRepo.update(filter.id, { name: 'New Name' })

      expect(updated?.name).toBe('New Name')
    })

    it('should update filter query', () => {
      const filter = filterRepo.create({ name: 'Test', query: 'old:query' })

      const updated = filterRepo.update(filter.id, { query: 'new:query' })

      expect(updated?.query).toBe('new:query')
    })

    it('should update filter color', () => {
      const filter = filterRepo.create({ name: 'Test', query: 'test' })

      const updated = filterRepo.update(filter.id, { color: '#0000ff' })

      expect(updated?.color).toBe('#0000ff')
    })

    it('should update isFavorite', () => {
      const filter = filterRepo.create({ name: 'Test', query: 'test' })

      expect(filter.isFavorite).toBe(false)

      const updated = filterRepo.update(filter.id, { isFavorite: true })

      expect(updated?.isFavorite).toBe(true)
    })

    it('should return null for non-existent filter', () => {
      const result = filterRepo.update('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should handle update with no changes', () => {
      const filter = filterRepo.create({ name: 'Test', query: 'test' })

      const updated = filterRepo.update(filter.id, {})

      expect(updated?.name).toBe('Test')
    })
  })

  describe('delete', () => {
    it('should delete a filter', () => {
      const filter = filterRepo.create({ name: 'Test', query: 'test' })

      const result = filterRepo.delete(filter.id)

      expect(result).toBe(true)
      expect(filterRepo.get(filter.id)).toBeNull()
    })

    it('should return false for non-existent filter', () => {
      const result = filterRepo.delete('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('reorder', () => {
    it('should update sort order', () => {
      const filter = filterRepo.create({ name: 'Test', query: 'test' })

      const updated = filterRepo.reorder(filter.id, 5.5)

      expect(updated?.sortOrder).toBe(5.5)
    })

    it('should return null for non-existent filter', () => {
      const result = filterRepo.reorder('non-existent', 5)
      expect(result).toBeNull()
    })
  })
})
