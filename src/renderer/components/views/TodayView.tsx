import React, { useState, useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { TaskSortOptions, sortTasks, groupTasks } from '../ui/TaskSortOptions'
import type { SortField, SortDirection, GroupBy } from '../ui/TaskSortOptions'
import { useTasks } from '@hooks/useTasks'
import { useProjects } from '@hooks/useProjects'
import { startOfDay } from '@shared/utils'
import type { Task, Priority } from '@shared/types'

export function TodayView(): React.ReactElement {
  const { tasks, loading, createTask, updateTask, completeTask, uncompleteTask, deleteTask, reorderTask } = useTasks({
    view: 'today'
  })
  const { projects } = useProjects()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [sortField, setSortField] = useState<SortField>('default')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const overdueTasks = useMemo(() => {
    const overdue = tasks.filter((t) => t.dueDate && t.dueDate < startOfDay(today))
    return sortTasks(overdue, sortField, sortDirection)
  }, [tasks, today, sortField, sortDirection])

  const todayTasks = useMemo(() => {
    const todayOnly = tasks.filter((t) => !t.dueDate || t.dueDate >= startOfDay(today))
    return sortTasks(todayOnly, sortField, sortDirection)
  }, [tasks, today, sortField, sortDirection])

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null
    return groupTasks(todayTasks, groupBy, projects)
  }, [todayTasks, groupBy, projects])

  const handleSaveTask = async (id: string, data: Parameters<typeof updateTask>[1]) => {
    await updateTask(id, data)
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
  }

  const handleUpdatePriority = async (id: string, priority: Priority) => {
    await updateTask(id, { priority })
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Today</h1>
            <p className="text-sm text-muted-foreground">{dateStr}</p>
          </div>
        </div>
        <TaskSortOptions
          sortField={sortField}
          sortDirection={sortDirection}
          groupBy={groupBy}
          onSortChange={(field, direction) => {
            setSortField(field)
            setSortDirection(direction)
          }}
          onGroupChange={setGroupBy}
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Overdue section */}
          {overdueTasks.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-destructive mb-2">
                Overdue ({overdueTasks.length})
              </h2>
              <TaskList
                tasks={overdueTasks}
                onComplete={completeTask}
                onUncomplete={uncompleteTask}
                onEdit={setEditingTask}
                onDelete={deleteTask}
                onUpdatePriority={handleUpdatePriority}
                onReorder={reorderTask}
                onCreate={async (data) => {
                  await createTask(data)
                }}
                showProject
                showAddInput={false}
              />
            </div>
          )}

          {/* Today section */}
          <div>
            {groupedTasks ? (
              // Grouped view
              groupedTasks.map((group) => (
                <div key={group.key} className="mb-4">
                  {group.label && (
                    <div className="flex items-center gap-2 mb-2">
                      {group.color && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
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
                    showProject
                    showAddInput={false}
                  />
                </div>
              ))
            ) : (
              // Flat view
              <>
                {overdueTasks.length > 0 && todayTasks.length > 0 && (
                  <h2 className="text-sm font-medium text-muted-foreground mb-2">
                    Today ({todayTasks.length})
                  </h2>
                )}
                <TaskList
                  tasks={todayTasks}
                  onComplete={completeTask}
                  onUncomplete={uncompleteTask}
                  onEdit={setEditingTask}
                  onDelete={deleteTask}
                  onUpdatePriority={handleUpdatePriority}
                  onReorder={reorderTask}
                  onCreate={async (data) => {
                    await createTask({
                      ...data,
                      dueDate: Date.now() // Set due date to today
                    })
                  }}
                  showProject
                  emptyMessage="No tasks for today. Enjoy your day!"
                />
              </>
            )}
          </div>
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
