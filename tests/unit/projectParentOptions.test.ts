import { describe, it, expect } from 'vitest'
import type { Project } from '../../src/shared/types'
import { getAvailableParentProjects } from '../../src/renderer/components/project/projectParentOptions'

function project(id: string, parentId: string | null = null): Project {
  return {
    id,
    name: id,
    description: null,
    color: '#808080',
    parentId,
    sortOrder: 0,
    viewMode: 'list',
    isFavorite: false,
    archivedAt: null,
    createdAt: Date.now(),
    deletedAt: null
  }
}

describe('getAvailableParentProjects', () => {
  it('returns all projects when creating a new project', () => {
    const projects = [project('a'), project('b')]
    const result = getAvailableParentProjects(projects)

    expect(result.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('excludes self and descendants when editing', () => {
    const projects = [project('root'), project('child', 'root'), project('grandchild', 'child'), project('peer')]
    const result = getAvailableParentProjects(projects, 'root')

    expect(result.map((p) => p.id)).toEqual(['peer'])
  })

  it('does not loop forever on cyclic project graphs', () => {
    const projects = [project('a', 'b'), project('b', 'a'), project('c')]
    const result = getAvailableParentProjects(projects, 'c')

    expect(result.map((p) => p.id).sort()).toEqual(['a', 'b'])
  })
})
