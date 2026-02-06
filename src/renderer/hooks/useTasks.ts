import { useState, useEffect, useCallback } from 'react'
import type { Task, TaskCreate, TaskUpdate } from '@shared/types'

interface UseTasksOptions {
  projectId?: string
  completed?: boolean
  view?: 'today' | 'upcoming' | 'overdue'
}

interface UseTasksResult {
  tasks: Task[]
  loading: boolean
  error: string | null
  createTask: (data: TaskCreate) => Promise<Task>
  updateTask: (id: string, data: TaskUpdate) => Promise<Task | null>
  deleteTask: (id: string) => Promise<boolean>
  completeTask: (id: string) => Promise<Task | null>
  uncompleteTask: (id: string) => Promise<Task | null>
  reorderTask: (taskId: string, newOrder: number, newParentId?: string | null) => Promise<Task | null>
  refresh: () => Promise<void>
}

export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let result: Task[]

      if (options.view === 'today') {
        result = await window.api.tasks.getToday()
      } else if (options.view === 'upcoming') {
        result = await window.api.tasks.getUpcoming(7)
      } else if (options.view === 'overdue') {
        result = await window.api.tasks.getOverdue()
      } else {
        result = await window.api.tasks.list({
          projectId: options.projectId,
          completed: options.completed
        })
      }

      setTasks(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }, [options.projectId, options.completed, options.view])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = useCallback(async (data: TaskCreate): Promise<Task> => {
    const task = await window.api.tasks.create(data)
    await fetchTasks()
    return task
  }, [fetchTasks])

  const updateTask = useCallback(async (id: string, data: TaskUpdate): Promise<Task | null> => {
    const task = await window.api.tasks.update(id, data)
    await fetchTasks()
    return task
  }, [fetchTasks])

  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    const result = await window.api.tasks.delete(id)
    await fetchTasks()
    return result
  }, [fetchTasks])

  const completeTask = useCallback(async (id: string): Promise<Task | null> => {
    const task = await window.api.tasks.complete(id)
    await fetchTasks()
    return task
  }, [fetchTasks])

  const uncompleteTask = useCallback(async (id: string): Promise<Task | null> => {
    const task = await window.api.tasks.uncomplete(id)
    await fetchTasks()
    return task
  }, [fetchTasks])

  const reorderTask = useCallback(async (
    taskId: string,
    newOrder: number,
    newParentId?: string | null
  ): Promise<Task | null> => {
    const task = await window.api.tasks.reorder(taskId, newOrder, newParentId)
    await fetchTasks()
    return task
  }, [fetchTasks])

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    reorderTask,
    refresh: fetchTasks
  }
}

export function useTask(id: string | null) {
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setTask(null)
      return
    }

    const fetchTask = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await window.api.tasks.get(id)
        setTask(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch task')
      } finally {
        setLoading(false)
      }
    }

    fetchTask()
  }, [id])

  return { task, loading, error }
}

export function useTaskSearch(query: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!query || query.length < 2) {
      setTasks([])
      return
    }

    const search = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await window.api.tasks.search(query)
        setTasks(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [query, refreshKey])

  return { tasks, loading, error, refresh }
}
