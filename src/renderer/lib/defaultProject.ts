import { INBOX_PROJECT_ID } from '@shared/constants'
import type { Project } from '@shared/types'

export function canUseAsDefaultProject(project: Project | null | undefined): boolean {
  if (!project) return false
  return project.archivedAt === null
}

export function getSelectableDefaultProjects(projects: Project[]): Project[] {
  return projects.filter((project) => canUseAsDefaultProject(project))
}

export function resolveDefaultProjectId(
  defaultProjectId: string,
  projects: Project[]
): string {
  if (defaultProjectId === INBOX_PROJECT_ID) {
    return INBOX_PROJECT_ID
  }

  const selectable = getSelectableDefaultProjects(projects)
  const found = selectable.find((project) => project.id === defaultProjectId)
  return found ? found.id : INBOX_PROJECT_ID
}
