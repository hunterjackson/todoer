import React, { useState } from 'react'
import { Calendar } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { useTasks } from '@hooks/useTasks'
import type { Task } from '@shared/types'

export function UpcomingView(): React.ReactElement {
  const { tasks, loading, createTask, updateTask, completeTask, uncompleteTask, deleteTask } = useTasks({
    view: 'upcoming'
  })
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Group tasks by date
  const tasksByDate = groupTasksByDate(tasks)

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
        <Calendar className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Upcoming</h1>
          <p className="text-sm text-muted-foreground">Next 7 days</p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No upcoming tasks in the next 7 days
        </div>
      ) : (
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
                onCreate={async (data) => {
                  await createTask({
                    ...data,
                    dueDate: parseInt(dateKey)
                  })
                }}
                showProject
                showAddInput={false}
              />
            </div>
          ))}
        </div>
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

function groupTasksByDate(tasks: Task[]): Record<string, Task[]> {
  const grouped: Record<string, Task[]> = {}

  for (const task of tasks) {
    if (!task.dueDate) continue

    const dateKey = startOfDay(new Date(task.dueDate)).toString()
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(task)
  }

  // Sort by date
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => parseInt(a) - parseInt(b))
  )
}

function startOfDay(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
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
