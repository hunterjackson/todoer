import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { TaskSortOptions, sortTasks, groupTasks } from '../ui/TaskSortOptions'
import { useStore } from '@renderer/stores/useStore'
import { useTaskSearch, useTasks } from '@hooks/useTasks'
import { useProjects } from '@hooks/useProjects'
import type { Task, Priority } from '@shared/types'

interface SearchViewProps {
  initialQuery?: string
}

export function SearchView({ initialQuery = '' }: SearchViewProps): React.ReactElement {
  const [query, setQuery] = useState(initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const { tasks, loading, refresh: refreshSearch } = useTaskSearch(query)
  const { completeTask, uncompleteTask, updateTask, deleteTask, createTask } = useTasks()
  const { projects } = useProjects()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [allExpanded, setAllExpanded] = useState(true)

  const viewKey = 'search'
  const viewSettings = useStore((s) => s.getViewSettings(viewKey))
  const setViewSettings = useStore((s) => s.setViewSettings)

  const { sortField, sortDirection, groupBy } = viewSettings

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sortedTasks = useMemo(() => {
    return sortTasks(tasks, sortField, sortDirection)
  }, [tasks, sortField, sortDirection])

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null
    return groupTasks(sortedTasks, groupBy, projects)
  }, [sortedTasks, groupBy, projects])

  const handleComplete = useCallback(async (id: string) => {
    await completeTask(id)
    refreshSearch()
  }, [completeTask, refreshSearch])

  const handleUncomplete = useCallback(async (id: string) => {
    await uncompleteTask(id)
    refreshSearch()
  }, [uncompleteTask, refreshSearch])

  const handleSaveTask = async (id: string, data: Parameters<typeof updateTask>[1]) => {
    await updateTask(id, data)
    refreshSearch()
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
    refreshSearch()
  }

  const handleUpdatePriority = async (id: string, priority: Priority) => {
    await updateTask(id, { priority })
    refreshSearch()
  }

  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev)
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks..."
          className="w-full pl-10 pr-10 py-3 text-lg bg-muted/50 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results */}
      {!query ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>Enter a search query to find tasks</p>
          <p className="text-sm mt-2">
            Search by task name or description
          </p>
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-muted-foreground">
          Searching...
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>No tasks found for &quot;{query}&quot;</p>
          <p className="text-sm mt-2">
            Try different keywords
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Found {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
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
                  onComplete={handleComplete}
                  onUncomplete={handleUncomplete}
                  onEdit={setEditingTask}
                  onDelete={handleDeleteTask}
                  onUpdatePriority={handleUpdatePriority}
                  showProject
                  showAddInput={false}
                  allExpanded={allExpanded}
                />
              </div>
            ))
          ) : (
            <TaskList
              tasks={sortedTasks}
              onComplete={handleComplete}
              onUncomplete={handleUncomplete}
              onEdit={setEditingTask}
              onDelete={handleDeleteTask}
              onUpdatePriority={handleUpdatePriority}
              onCreate={async (data) => { await createTask(data); refreshSearch() }}
              showProject
              showAddInput={false}
              allExpanded={allExpanded}
            />
          )}
        </div>
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
