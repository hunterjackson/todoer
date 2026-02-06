import { describe, it, expect } from 'vitest'
import type { Project } from '../../src/shared/types'
import {
  getSelectableDefaultProjects,
  resolveDefaultProjectId,
  canUseAsDefaultProject
} from '../../src/renderer/lib/defaultProject'

function makeProject(id: string, archivedAt: number | null = null): Project {
  return {
    id,
    name: id,
    description: null,
    color: '#808080',
    parentId: null,
    sortOrder: 0,
    viewMode: 'list',
    isFavorite: false,
    archivedAt,
    createdAt: Date.now(),
    deletedAt: null
  }
}

describe('default project selection helpers', () => {
  it('filters archived projects out of default-project choices', () => {
    const projects = [makeProject('inbox'), makeProject('active'), makeProject('archived', Date.now())]
    const selectable = getSelectableDefaultProjects(projects)
    expect(selectable.map((p) => p.id)).toEqual(['inbox', 'active'])
  })

  it('falls back to inbox when default project is archived', () => {
    const projects = [makeProject('inbox'), makeProject('archived', Date.now())]
    const resolved = resolveDefaultProjectId('archived', projects)
    expect(resolved).toBe('inbox')
  })

  it('accepts inbox even when project lookup is missing', () => {
    const resolved = resolveDefaultProjectId('inbox', [])
    expect(resolved).toBe('inbox')
  })

  it('rejects archived projects as quick-add defaults', () => {
    expect(canUseAsDefaultProject(makeProject('archived', Date.now()))).toBe(false)
    expect(canUseAsDefaultProject(makeProject('active'))).toBe(true)
    expect(canUseAsDefaultProject(null)).toBe(false)
  })
})
