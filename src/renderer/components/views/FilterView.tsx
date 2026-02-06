import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Filter } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { TaskSortOptions, sortTasks, groupTasks } from '../ui/TaskSortOptions'
import { useStore } from '@renderer/stores/useStore'
import { useProjects } from '@hooks/useProjects'
import { useSettings } from '@hooks/useSettings'
import type { Task, TaskUpdate, Filter as FilterType, Priority } from '@shared/types'

interface FilterViewProps {
  filterId: string
}

export function FilterView({ filterId }: FilterViewProps): React.ReactElement {
  const [filter, setFilter] = useState<FilterType | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [allExpanded, setAllExpanded] = useState(true)
  const { projects } = useProjects()
  const { settings } = useSettings()

  const viewKey = `filter-${filterId}`
  const viewSettings = useStore((s) => s.getViewSettings(viewKey))
  const setViewSettings = useStore((s) => s.setViewSettings)

  const { sortField, sortDirection, groupBy } = viewSettings

  const fetchFilter = useCallback(async () => {
    try {
      const filters = await window.api.filters.list()
      const found = filters.find((f: FilterType) => f.id === filterId)
      setFilter(found || null)
      return found
    } catch {
      return null
    }
  }, [filterId])

  const fetchTasks = useCallback(async (query: string) => {
    try {
      setLoading(true)
      const filteredTasks = await window.api.filters.evaluate(query)
      setTasks(filteredTasks)
    } catch {
      // Failed to evaluate filter
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

  const sortedTasks = useMemo(() => {
    return sortTasks(tasks, sortField, sortDirection)
  }, [tasks, sortField, sortDirection])

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null
    return groupTasks(sortedTasks, groupBy, projects, settings.dateFormat)
  }, [sortedTasks, groupBy, projects, settings.dateFormat])

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

  const handleUpdatePriority = async (id: string, priority: Priority) => {
    await window.api.tasks.update(id, { priority })
    if (filter) fetchTasks(filter.query)
  }

  const handleReorderTask = async (id: string, newOrder: number, newParentId?: string | null) => {
    await window.api.tasks.reorder(id, newOrder, newParentId ?? null)
    if (filter) fetchTasks(filter.query)
  }

  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev)
  }, [])

  if (!filter && !loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Filter not found</h1>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
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
        <TaskSortOptions
          sortField={sortField}
          sortDirection={sortDirection}
          groupBy={groupBy}
          onSortChange={(field, direction) => setViewSettings(viewKey, { sortField: field, sortDirection: direction })}
          onGroupChange={(g) => setViewSettings(viewKey, { groupBy: g })}
          allExpanded={allExpanded}
          onToggleExpandAll={handleToggleExpandAll}
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <>
          {groupedTasks ? (
            groupedTasks.map((group) => (
              <div key={group.key} className="mb-4">
                {group.label && (
                  <div className="flex items-center gap-2 mb-2">
                    {group.color && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                    )}
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {group.label} ({group.tasks.length})
                    </h3>
                  </div>
                )}
                <TaskList
                  tasks={group.tasks}
                  onComplete={handleCompleteTask}
                  onUncomplete={handleUncompleteTask}
                  onEdit={setEditingTask}
                  onDelete={handleDeleteTask}
                  onUpdatePriority={handleUpdatePriority}
                  onReorder={handleReorderTask}
                  showProject
                  showAddInput={false}
                  allExpanded={allExpanded}
                />
              </div>
            ))
          ) : sortedTasks.length > 0 ? (
            <TaskList
              tasks={sortedTasks}
              onComplete={handleCompleteTask}
              onUncomplete={handleUncompleteTask}
              onEdit={setEditingTask}
              onDelete={handleDeleteTask}
              onUpdatePriority={handleUpdatePriority}
              onReorder={handleReorderTask}
              showProject
              showAddInput={false}
              allExpanded={allExpanded}
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
        onEditTask={setEditingTask}
      />
    </div>
  )
}
