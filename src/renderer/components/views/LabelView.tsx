import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Tag, Plus } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskAddInput } from '../task/TaskAddInput'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { TaskSortOptions, sortTasks, groupTasks } from '../ui/TaskSortOptions'
import { CompletedTasksSection } from '../task/CompletedTasksSection'
import { useStore } from '@renderer/stores/useStore'
import { useLabels } from '@hooks/useLabels'
import { useProjects } from '@hooks/useProjects'
import { useSettings } from '@hooks/useSettings'
import type { Task, TaskCreate, TaskUpdate, Priority } from '@shared/types'

interface LabelViewProps {
  labelId: string
}

export function LabelView({ labelId }: LabelViewProps): React.ReactElement {
  const { labels } = useLabels()
  const { projects } = useProjects()
  const { settings } = useSettings()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)
  const [allExpanded, setAllExpanded] = useState(true)

  const viewKey = `label-${labelId}`
  const viewSettings = useStore((s) => s.getViewSettings(viewKey))
  const setViewSettings = useStore((s) => s.setViewSettings)

  const { sortField, sortDirection, groupBy, showCompleted } = viewSettings

  const label = labels.find((l) => l.id === labelId)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const labelTasks = await window.api.tasks.getByLabel(labelId)
      setTasks(labelTasks)
    } catch {
      // Failed to fetch label tasks
    } finally {
      setLoading(false)
    }
  }, [labelId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const sortedTasks = useMemo(() => {
    return sortTasks(tasks, sortField, sortDirection)
  }, [tasks, sortField, sortDirection])

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null
    return groupTasks(sortedTasks, groupBy, projects, settings.dateFormat)
  }, [sortedTasks, groupBy, projects, settings.dateFormat])

  const handleCreateTask = async (data: TaskCreate) => {
    const labelIds = new Set(data.labelIds || [])
    labelIds.add(labelId)
    await window.api.tasks.create({
      ...data,
      labelIds: [...labelIds]
    })
    setShowAddInput(false)
    fetchTasks()
  }

  const handleCompleteTask = async (id: string) => {
    await window.api.tasks.complete(id)
    fetchTasks()
  }

  const handleUncompleteTask = async (id: string) => {
    await window.api.tasks.uncomplete(id)
    fetchTasks()
  }

  const handleSaveTask = async (id: string, data: TaskUpdate) => {
    await window.api.tasks.update(id, data)
    fetchTasks()
  }

  const handleDeleteTask = async (id: string) => {
    await window.api.tasks.delete(id)
    fetchTasks()
  }

  const handleUpdatePriority = async (id: string, priority: Priority) => {
    await window.api.tasks.update(id, { priority })
    fetchTasks()
  }

  const handleReorderTask = async (id: string, newOrder: number, newParentId?: string | null) => {
    await window.api.tasks.reorder(id, newOrder, newParentId ?? null)
    fetchTasks()
  }

  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev)
  }, [])

  if (!label) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Label not found</h1>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6" style={{ color: label.color }} />
          <div>
            <h1 className="text-2xl font-bold">{label.name}</h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
        </div>
        <TaskSortOptions
          sortField={sortField}
          sortDirection={sortDirection}
          groupBy={groupBy}
          onSortChange={(field, direction) => setViewSettings(viewKey, { sortField: field, sortDirection: direction })}
          onGroupChange={(g) => setViewSettings(viewKey, { groupBy: g })}
          showCompleted={showCompleted}
          onToggleCompleted={(show) => setViewSettings(viewKey, { showCompleted: show })}
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
          ) : (
            <>
              {sortedTasks.length > 0 ? (
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
              ) : null}

              {showAddInput ? (
                <TaskAddInput
                  onSubmit={handleCreateTask}
                  onCancel={() => setShowAddInput(false)}
                  placeholder={`Add task with #${label.name}`}
                />
              ) : (
                <button
                  onClick={() => setShowAddInput(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add task
                </button>
              )}

              {sortedTasks.length === 0 && !showAddInput && (
                <div className="text-center py-12 text-muted-foreground">
                  <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: label.color }} />
                  <p>No tasks with this label</p>
                </div>
              )}
            </>
          )}

          {showCompleted && (
            <CompletedTasksSection
              labelId={labelId}
              onUncomplete={handleUncompleteTask}
              onEdit={setEditingTask}
              onDelete={handleDeleteTask}
              autoExpand
            />
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
