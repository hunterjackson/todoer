import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { INBOX_PROJECT_ID } from '@shared/constants'

let db: SqlJsDatabase | null = null
let dbPath: string | null = null

// Get path to the sql.js WASM file
function getWasmPath(): string | undefined {
  // In development, use node_modules path
  if (process.env.NODE_ENV !== 'production' && !app?.isPackaged) {
    return join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
  }
  // In production, WASM is bundled as an extra resource
  if (process.resourcesPath) {
    const prodPath = join(process.resourcesPath, 'sql-wasm.wasm')
    if (existsSync(prodPath)) {
      return prodPath
    }
  }
  // Fall back to ASM.js version
  return undefined
}

// Check if we're in a test environment
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.TODOER_TEST_MODE === 'true'
  )
}

// Get database path based on environment
function getDatabasePath(): string {
  const inTestMode = isTestEnvironment()

  // SAFETY CHECK: In test mode, ALWAYS use in-memory database
  // This is a hard requirement to prevent test pollution of production data
  if (inTestMode) {
    return ':memory:'
  }

  // SAFETY CHECK: If custom data path is empty string, use in-memory
  // This catches cases where tests clear this variable as a safeguard
  if (process.env.TODOER_DATA_PATH === '') {
    return ':memory:'
  }

  // Check for custom data path environment variable
  if (process.env.TODOER_DATA_PATH) {
    const customPath = process.env.TODOER_DATA_PATH
    if (!existsSync(customPath)) {
      mkdirSync(customPath, { recursive: true })
    }
    return join(customPath, 'todoer.db')
  }

  // For development/production, use user data directory
  const userDataPath = app?.getPath?.('userData') || join(process.cwd(), '.data')

  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  return join(userDataPath, 'todoer.db')
}

// Run migrations to add missing columns to existing tables
function runMigrations(database: SqlJsDatabase): void {
  // Get existing columns in projects table
  const projectCols = database.exec("PRAGMA table_info(projects)")
  const projectColNames = projectCols[0]?.values.map(row => row[1]) || []

  // Add description column to projects if missing
  if (!projectColNames.includes('description')) {
    database.run('ALTER TABLE projects ADD COLUMN description TEXT')
  }

  // Get existing columns in comments table
  const commentCols = database.exec("PRAGMA table_info(comments)")
  const commentColNames = commentCols[0]?.values.map(row => row[1]) || []

  // Add project_id column to comments if missing (supports project comments)
  if (commentColNames.length > 0 && !commentColNames.includes('project_id')) {
    database.run('ALTER TABLE comments ADD COLUMN project_id TEXT')
  }

  // Add delegated_to column to tasks if missing
  const taskCols = database.exec("PRAGMA table_info(tasks)")
  const taskColNames = taskCols[0]?.values.map(row => row[1]) || []

  if (!taskColNames.includes('delegated_to')) {
    database.run('ALTER TABLE tasks ADD COLUMN delegated_to TEXT')
  }

  // Create task_attachments table if missing (stores files as BLOBs)
  database.run(`
    CREATE TABLE IF NOT EXISTS task_attachments (
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
  database.run('CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id)')
}

// Initialize database with schema
function initSchema(database: SqlJsDatabase): void {
  database.run(`
    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      description TEXT,
      project_id TEXT REFERENCES projects(id),
      section_id TEXT REFERENCES sections(id),
      parent_id TEXT REFERENCES tasks(id),
      due_date INTEGER,
      deadline INTEGER,
      duration INTEGER,
      recurrence_rule TEXT,
      priority INTEGER NOT NULL DEFAULT 4,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      sort_order REAL NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      delegated_to TEXT
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#808080',
      parent_id TEXT REFERENCES projects(id),
      sort_order REAL NOT NULL,
      view_mode TEXT NOT NULL DEFAULT 'list',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    -- Sections table
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id),
      sort_order REAL NOT NULL,
      is_collapsed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- Labels table
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#808080',
      sort_order REAL NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- Task-Label junction table
    CREATE TABLE IF NOT EXISTS task_labels (
      task_id TEXT NOT NULL REFERENCES tasks(id),
      label_id TEXT NOT NULL REFERENCES labels(id),
      PRIMARY KEY (task_id, label_id)
    );

    -- Filters table
    CREATE TABLE IF NOT EXISTS filters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#808080',
      sort_order REAL NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- Comments table (supports both task and project comments)
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id),
      project_id TEXT REFERENCES projects(id),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (task_id IS NOT NULL OR project_id IS NOT NULL)
    );

    -- Attachments table
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL REFERENCES comments(id),
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL
    );

    -- Reminders table
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      remind_at INTEGER NOT NULL,
      notified INTEGER NOT NULL DEFAULT 0
    );

    -- Activity log table
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      changes_json TEXT,
      created_at INTEGER NOT NULL
    );

    -- Karma stats table
    CREATE TABLE IF NOT EXISTS karma_stats (
      id TEXT PRIMARY KEY DEFAULT 'default',
      total_points INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      daily_goal INTEGER NOT NULL DEFAULT 5,
      weekly_goal INTEGER NOT NULL DEFAULT 25
    );

    -- Karma history table
    CREATE TABLE IF NOT EXISTS karma_history (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      tasks_completed INTEGER NOT NULL DEFAULT 0
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed, completed_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id);
    CREATE INDEX IF NOT EXISTS idx_sections_project ON sections(project_id);
    CREATE INDEX IF NOT EXISTS idx_task_labels_task ON task_labels(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_labels_label ON task_labels(label_id);
    CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_task ON reminders(task_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_delegated ON tasks(delegated_to) WHERE delegated_to IS NOT NULL;
  `)
}

// Seed initial data (Inbox project)
function seedInitialData(database: SqlJsDatabase): void {
  const now = Date.now()

  // Check if Inbox exists
  const inboxStmt = database.prepare('SELECT id FROM projects WHERE id = ?')
  inboxStmt.bind([INBOX_PROJECT_ID])
  const inboxExists = inboxStmt.step()
  inboxStmt.free()

  if (!inboxExists) {
    database.run(
      `INSERT INTO projects (id, name, color, sort_order, view_mode, is_favorite, created_at)
       VALUES (?, 'Inbox', '#246fe0', 0, 'list', 0, ?)`,
      [INBOX_PROJECT_ID, now]
    )
  }

  // Initialize karma stats if not exists
  const karmaExists = database.exec(`SELECT id FROM karma_stats WHERE id = 'default'`)

  if (karmaExists.length === 0 || karmaExists[0].values.length === 0) {
    database.run(`
      INSERT INTO karma_stats (id, total_points, current_streak, longest_streak, daily_goal, weekly_goal)
      VALUES ('default', 0, 0, 0, 5, 25)
    `)
  }
}

// Initialize database
export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  // Initialize sql.js - try to use WASM if available
  const wasmPath = getWasmPath()
  let SQL
  try {
    if (wasmPath && existsSync(wasmPath)) {
      SQL = await initSqlJs({
        locateFile: () => wasmPath
      })
    } else {
      // Fall back to ASM.js version which doesn't need WASM
      SQL = await initSqlJs()
    }
  } catch (error) {
    console.error('Failed to init sql.js with WASM, trying without:', error)
    SQL = await initSqlJs()
  }

  dbPath = getDatabasePath()

  // CRITICAL SAFETY CHECK: Throw hard error if test mode detected but not using in-memory DB
  // This is the last line of defense against test pollution of production data
  if (isTestEnvironment() && dbPath !== ':memory:') {
    throw new Error(
      `SAFETY VIOLATION: Test environment detected but database path is "${dbPath}" instead of ":memory:". ` +
        'This would pollute production data. Aborting to protect your data.'
    )
  }

  if (dbPath === ':memory:') {
    db = new SQL.Database()
  } else {
    // Try to load existing database
    try {
      if (existsSync(dbPath)) {
        const buffer = readFileSync(dbPath)
        db = new SQL.Database(buffer)
      } else {
        db = new SQL.Database()
      }
    } catch {
      db = new SQL.Database()
    }
  }

  // SQLite FK checks are disabled by default and must be enabled per connection.
  db.run('PRAGMA foreign_keys = ON')

  // Initialize schema
  initSchema(db)

  // Run migrations for existing databases
  runMigrations(db)

  // Seed initial data
  seedInitialData(db)

  // Save to disk (for non-memory databases)
  saveDatabase()

  return db
}

// Get database instance (throws if not initialized)
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// Create in-memory database for testing
export async function createTestDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs()
  const testDb = new SQL.Database()
  // Ensure tests run with the same FK guarantees as production.
  testDb.run('PRAGMA foreign_keys = ON')
  initSchema(testDb)
  runMigrations(testDb)
  seedInitialData(testDb)
  return testDb
}

// Save database to disk
export function saveDatabase(): void {
  if (db && dbPath && dbPath !== ':memory:') {
    try {
      const data = db.export()
      const buffer = Buffer.from(data)
      writeFileSync(dbPath, buffer)
    } catch (error) {
      console.error('Failed to save database:', error)
    }
  }
}

// Close database connection
export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
    dbPath = null
  }
}

// Helper to run a query and get results as objects
export function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase()
  const stmt = database.prepare(sql)

  if (params.length > 0) {
    stmt.bind(params)
  }

  const results: T[] = []

  while (stmt.step()) {
    const row = stmt.getAsObject() as T
    results.push(row)
  }

  stmt.free()
  return results
}

// Helper to run a query and get a single result
export function queryOne<T>(sql: string, params: unknown[] = []): T | null {
  const results = queryAll<T>(sql, params)
  return results[0] ?? null
}

// Helper to run a command (INSERT, UPDATE, DELETE)
export function run(sql: string, params: unknown[] = []): void {
  const database = getDatabase()
  database.run(sql, params)
  saveDatabase()
}
