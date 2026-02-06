import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDatabase } from '@main/db'
import { handleToolCall } from '@main/mcp/tools'
import { TaskRepository } from '@main/db/repositories/taskRepository'
import { ProjectRepository } from '@main/db/repositories/projectRepository'
import { LabelRepository } from '@main/db/repositories/labelRepository'
import { KarmaRepository } from '@main/db/repositories/karmaRepository'
import { KarmaEngine } from '@main/services/karmaEngine'
import type { Database as SqlJsDatabase } from 'sql.js'

describe('MCP Tools', () => {
  let db: SqlJsDatabase
  let taskRepo: TaskRepository
  let projectRepo: ProjectRepository
  let labelRepo: LabelRepository
  let karmaRepo: KarmaRepository
  let karmaEngine: KarmaEngine

  beforeEach(async () => {
    db = await createTestDatabase()
    taskRepo = new TaskRepository(db)
    projectRepo = new ProjectRepository(db)
    labelRepo = new LabelRepository(db)
    karmaRepo = new KarmaRepository(db)
    karmaEngine = new KarmaEngine(karmaRepo)
  })

  afterEach(() => {
    db.close()
  })

  it('normalizes out-of-range create_task priority to 4', () => {
    handleToolCall(
      'todoer_create_task',
      { content: 'Priority normalization task', priority: 99 },
      { taskRepo, projectRepo, labelRepo, karmaEngine }
    )

    const created = taskRepo.list({}).find((t) => t.content === 'Priority normalization task')
    expect(created).toBeDefined()
    expect(created?.priority).toBe(4)
  })
})
