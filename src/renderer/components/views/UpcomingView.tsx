import React, { useState, useMemo, useCallback } from 'react'
import { Calendar } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { TaskSortOptions, sortTasks } from '../ui/TaskSortOptions'
import { CompletedTasksSection } from '../task/CompletedTasksSection'
import { useStore } from '@renderer/stores/useStore'
import { useTasks } from '@hooks/useTasks'
import { startOfDay } from '@shared/utils'
import type { Task, Priority } from '@shared/types'

export function UpcomingView(): React.ReactElement {
  const { tasks, loading, createTask, updateTask, completeTask, uncompleteTask, deleteTask, reorderTask } = useTasks({
    view: 'upcoming'
  })
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [allExpanded, setAllExpanded] = useState(true)

  const viewKey = 'upcoming'
  const viewSettings = useStore((s) => s.getViewSettings(viewKey))
  const setViewSettings = useStore((s) => s.setViewSettings)

  const { sortField, sortDirection, groupBy, showCompleted } = viewSettings

  // Group tasks by date, with optional sorting within each group
  const tasksByDate = useMemo(() => {
    return groupTasksByDate(tasks, sortField, sortDirection)
  }, [tasks, sortField, sortDirection])

  const handleSaveTask = async (id: string, data: Parameters<typeof updateTask>[1]) => {
    await updateTask(id, data)
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
  }

  const handleUpdatePriority = async (id: string, priority: Priority) => {
    await updateTask(id, { priority })
  }

  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev)
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Upcoming</h1>
            <p className="text-sm text-muted-foreground">Next 7 days</p>
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
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No upcoming tasks in the next 7 days
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {Object.entries(tasksByDate).map(([dateKey, dateTasks]) => (
              <div key={dateKey}>
                <h2 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-2">
                  {formatDateHeader(dateKey)}
                  <span className="ml-2 text-xs">({dateTasks.length})</span>
                </h2>
                <TaskList
                  tasks={dateTasks}
                  onComplete={completeTask}
                  onUncomplete={uncompleteTask}
                  onEdit={setEditingTask}
                  onDelete={deleteTask}
                  onUpdatePriority={handleUpdatePriority}
                  onReorder={reorderTask}
                  onCreate={async (data) => {
                    await createTask({
                      ...data,
                      dueDate: parseInt(dateKey)
                    })
                  }}
                  showProject
                  showAddInput={false}
                  allExpanded={allExpanded}
                />
              </div>
            ))}
          </div>

          {showCompleted && (
            <CompletedTasksSection
              onUncomplete={uncompleteTask}
              onEdit={setEditingTask}
              onDelete={deleteTask}
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

function groupTasksByDate(tasks: Task[], sortField?: string, sortDirection?: string): Record<string, Task[]> {
  const grouped: Record<string, Task[]> = {}

  for (const task of tasks) {
    if (!task.dueDate) continue

    const dateKey = startOfDay(new Date(task.dueDate)).toString()
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(task)
  }

  // Sort within each group if sort field is set
  if (sortField && sortField !== 'default') {
    for (const key of Object.keys(grouped)) {
      grouped[key] = sortTasks(grouped[key], sortField as any, (sortDirection || 'asc') as any)
    }
  }

  // Sort by date
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => parseInt(a) - parseInt(b))
  )
}

function formatDateHeader(timestamp: string): string {
  const date = new Date(parseInt(timestamp))
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayStart = startOfDay(today)
  const tomorrowStart = startOfDay(tomorrow)
  const dateStart = parseInt(timestamp)

  if (dateStart === todayStart) {
    return 'Today'
  }
  if (dateStart === tomorrowStart) {
    return 'Tomorrow'
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
}
