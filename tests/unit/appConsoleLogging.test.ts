import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

describe('App renderer error handling', () => {
  it('does not log task move failures with console.error', () => {
    const source = readFileSync(join(process.cwd(), 'src/renderer/App.tsx'), 'utf-8')
    expect(source).not.toMatch(/console\.error\(\s*['"]Failed to move task:/)
  })
})
