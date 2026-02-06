import React, { useState, useMemo, useCallback } from 'react'
import { Inbox } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { TaskSortOptions, sortTasks, groupTasks } from '../ui/TaskSortOptions'
import { CompletedTasksSection } from '../task/CompletedTasksSection'
import { useStore } from '@renderer/stores/useStore'
import { useTasks } from '@hooks/useTasks'
import { useProjects } from '@hooks/useProjects'
import { INBOX_PROJECT_ID } from '@shared/constants'
import type { Task, Priority } from '@shared/types'

export function InboxView(): React.ReactElement {
  const { tasks, loading, createTask, updateTask, completeTask, uncompleteTask, deleteTask, reorderTask } = useTasks({
    projectId: INBOX_PROJECT_ID,
    completed: false
  })
  const { projects } = useProjects()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [allExpanded, setAllExpanded] = useState(true)

  const viewKey = 'inbox'
  const viewSettings = useStore((s) => s.getViewSettings(viewKey))
  const setViewSettings = useStore((s) => s.setViewSettings)

  const { sortField, sortDirection, groupBy, showCompleted } = viewSettings

  const sortedTasks = useMemo(() => {
    return sortTasks(tasks, sortField, sortDirection)
  }, [tasks, sortField, sortDirection])

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null
    return groupTasks(sortedTasks, groupBy, projects)
  }, [sortedTasks, groupBy, projects])

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
          <Inbox className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Inbox</h1>
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
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
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
                  onComplete={completeTask}
                  onUncomplete={uncompleteTask}
                  onEdit={setEditingTask}
                  onDelete={deleteTask}
                  onUpdatePriority={handleUpdatePriority}
                  onReorder={reorderTask}
                  showAddInput={false}
                  allExpanded={allExpanded}
                />
              </div>
            ))
          ) : (
            <TaskList
              tasks={sortedTasks}
              onComplete={completeTask}
              onUncomplete={uncompleteTask}
              onEdit={setEditingTask}
              onDelete={deleteTask}
              onUpdatePriority={handleUpdatePriority}
              onReorder={reorderTask}
              onCreate={async (data) => {
                await createTask({
                  ...data,
                  projectId: INBOX_PROJECT_ID
                })
              }}
              emptyMessage="Your inbox is empty. Capture tasks here before organizing them into projects."
              allExpanded={allExpanded}
            />
          )}

          {showCompleted && (
            <CompletedTasksSection
              projectId={INBOX_PROJECT_ID}
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
