import React, { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { useTasks } from '@hooks/useTasks'
import { startOfDay } from '@shared/utils'
import type { Task } from '@shared/types'

export function TodayView(): React.ReactElement {
  const { tasks, loading, createTask, updateTask, completeTask, uncompleteTask, deleteTask } = useTasks({
    view: 'today'
  })
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < startOfDay(today))
  const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate >= startOfDay(today))

  const handleSaveTask = async (id: string, data: Parameters<typeof updateTask>[1]) => {
    await updateTask(id, data)
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-sm text-muted-foreground">{dateStr}</p>
        </div>
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
              onCreate={async (data) => {
                await createTask({
                  ...data,
                  dueDate: Date.now() // Set due date to today
                })
              }}
              showProject
              emptyMessage="No tasks for today. Enjoy your day!"
            />
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
