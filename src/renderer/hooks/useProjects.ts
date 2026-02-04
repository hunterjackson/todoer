import { useState, useEffect, useCallback } from 'react'
import type { Project, ProjectCreate, ProjectUpdate } from '@shared/types'

interface UseProjectsResult {
  projects: Project[]
  loading: boolean
  error: string | null
  createProject: (data: ProjectCreate) => Promise<Project>
  updateProject: (id: string, data: ProjectUpdate) => Promise<Project | null>
  deleteProject: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.projects.list()
      setProjects(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = useCallback(async (data: ProjectCreate): Promise<Project> => {
    const project = await window.api.projects.create(data)
    await fetchProjects()
    return project
  }, [fetchProjects])

  const updateProject = useCallback(async (id: string, data: ProjectUpdate): Promise<Project | null> => {
    const project = await window.api.projects.update(id, data)
    await fetchProjects()
    return project
  }, [fetchProjects])

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    const result = await window.api.projects.delete(id)
    await fetchProjects()
    return result
  }, [fetchProjects])

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh: fetchProjects
  }
}

export function useProject(id: string | null) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setProject(null)
      return
    }

    const fetchProject = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await window.api.projects.get(id)
        setProject(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch project')
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [id])

  return { project, loading, error }
}
