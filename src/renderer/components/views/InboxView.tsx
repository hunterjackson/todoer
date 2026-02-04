import React, { useState } from 'react'
import { Inbox } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { CompletedTasksSection } from '../task/CompletedTasksSection'
import { useTasks } from '@hooks/useTasks'
import { INBOX_PROJECT_ID } from '@shared/constants'
import type { Task } from '@shared/types'

export function InboxView(): React.ReactElement {
  const { tasks, loading, createTask, updateTask, completeTask, uncompleteTask, deleteTask } = useTasks({
    projectId: INBOX_PROJECT_ID,
    completed: false
  })
  const [editingTask, setEditingTask] = useState<Task | null>(null)

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
        <Inbox className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <>
          <TaskList
            tasks={tasks}
            onComplete={completeTask}
            onUncomplete={uncompleteTask}
            onEdit={setEditingTask}
            onDelete={deleteTask}
            onCreate={async (data) => {
              await createTask({
                ...data,
                projectId: INBOX_PROJECT_ID
              })
            }}
            emptyMessage="Your inbox is empty. Capture tasks here before organizing them into projects."
          />

          <CompletedTasksSection
            projectId={INBOX_PROJECT_ID}
            onUncomplete={uncompleteTask}
            onEdit={setEditingTask}
            onDelete={deleteTask}
          />
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
