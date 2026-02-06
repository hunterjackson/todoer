import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

describe('Database seed query safety', () => {
  it('does not interpolate INBOX_PROJECT_ID directly into SQL in seedInitialData', () => {
    const source = readFileSync(join(process.cwd(), 'src/main/db/index.ts'), 'utf-8')
    expect(source).not.toMatch(/SELECT id FROM projects WHERE id = '\$\{INBOX_PROJECT_ID\}'/)
    expect(source).not.toMatch(/VALUES \('\$\{INBOX_PROJECT_ID\}', 'Inbox'/)
  })
})
