import React, { useState, useEffect, useCallback } from 'react'
import { Filter } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import type { Task, TaskUpdate, Filter as FilterType } from '@shared/types'

interface FilterViewProps {
  filterId: string
}

export function FilterView({ filterId }: FilterViewProps): React.ReactElement {
  const [filter, setFilter] = useState<FilterType | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const fetchFilter = useCallback(async () => {
    try {
      const filters = await window.api.filters.list()
      const found = filters.find((f: FilterType) => f.id === filterId)
      setFilter(found || null)
      return found
    } catch (err) {
      console.error('Failed to fetch filter:', err)
      return null
    }
  }, [filterId])

  const fetchTasks = useCallback(async (query: string) => {
    try {
      setLoading(true)
      const filteredTasks = await window.api.filters.evaluate(query)
      setTasks(filteredTasks)
    } catch (err) {
      console.error('Failed to evaluate filter:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFilter().then((f) => {
      if (f) {
        fetchTasks(f.query)
      } else {
        setLoading(false)
      }
    })
  }, [fetchFilter, fetchTasks])

  const handleCompleteTask = async (id: string) => {
    await window.api.tasks.complete(id)
    if (filter) fetchTasks(filter.query)
  }

  const handleUncompleteTask = async (id: string) => {
    await window.api.tasks.uncomplete(id)
    if (filter) fetchTasks(filter.query)
  }

  const handleSaveTask = async (id: string, data: TaskUpdate) => {
    await window.api.tasks.update(id, data)
    if (filter) fetchTasks(filter.query)
  }

  const handleDeleteTask = async (id: string) => {
    await window.api.tasks.delete(id)
    if (filter) fetchTasks(filter.query)
  }

  if (!filter && !loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Filter not found</h1>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-6 h-6" style={{ color: filter?.color || '#808080' }} />
        <div>
          <h1 className="text-2xl font-bold">{filter?.name || 'Loading...'}</h1>
          {filter && (
            <p className="text-sm text-muted-foreground font-mono">
              {filter.query}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <>
          {tasks.length > 0 ? (
            <TaskList
              tasks={tasks}
              onComplete={handleCompleteTask}
              onUncomplete={handleUncompleteTask}
              onEdit={setEditingTask}
              onDelete={handleDeleteTask}
              showProject
              showAddInput={false}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No tasks match this filter</p>
            </div>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}
