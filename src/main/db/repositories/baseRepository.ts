import type { Database as SqlJsDatabase } from 'sql.js'
import { saveDatabase } from '../index'

/**
 * Base repository class providing common database operations.
 * Repositories can extend this to inherit query helper methods.
 */
export abstract class BaseRepository<TRow, TEntity> {
  constructor(protected db: SqlJsDatabase) {}

  /**
   * Execute a query and return all matching rows as type T
   */
  protected queryAll<T = TRow>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params)
    }
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return results
  }

  /**
   * Execute a query and return the first matching row or null
   */
  protected queryOne<T = TRow>(sql: string, params: unknown[] = []): T | null {
    const results = this.queryAll<T>(sql, params)
    return results[0] ?? null
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  protected run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params)
    saveDatabase()
  }

  /**
   * Convert a database row to a domain entity.
   * Must be implemented by derived classes.
   */
  protected abstract rowToEntity(row: TRow): TEntity

  /**
   * Get the max sort order for auto-incrementing
   */
  protected getMaxSortOrder(tableName: string, whereClause?: string): number {
    const sql = whereClause
      ? `SELECT MAX(sort_order) as max_order FROM ${tableName} WHERE ${whereClause}`
      : `SELECT MAX(sort_order) as max_order FROM ${tableName}`
    const result = this.queryOne<{ max_order: number | null }>(sql)
    return (result?.max_order ?? 0) + 1
  }
}
