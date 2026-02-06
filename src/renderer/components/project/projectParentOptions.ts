import type { Project } from '@shared/types'

/**
 * Returns selectable parent projects for a project edit/create flow.
 * For edit, excludes self and descendants and guards against cyclic data.
 */
export function getAvailableParentProjects(
  projects: Project[],
  editingProjectId?: string
): Project[] {
  if (!editingProjectId) {
    return projects
  }

  const projectById = new Map(projects.map((project) => [project.id, project]))

  return projects.filter((candidate) => {
    if (candidate.id === editingProjectId) {
      return false
    }

    const visited = new Set<string>()
    let current: Project | undefined = candidate

    while (current?.parentId) {
      if (visited.has(current.id)) {
        // Defensive break for cyclic graphs from corrupted/external data.
        break
      }
      visited.add(current.id)

      if (current.parentId === editingProjectId) {
        return false
      }

      current = projectById.get(current.parentId)
    }

    return true
  })
}
