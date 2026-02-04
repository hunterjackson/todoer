import React, { useState, useEffect, useCallback } from 'react'
import { Hash, Plus } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskAddInput } from '../task/TaskAddInput'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { useLabels } from '@hooks/useLabels'
import type { Task, TaskCreate, TaskUpdate } from '@shared/types'

interface LabelViewProps {
  labelId: string
}

export function LabelView({ labelId }: LabelViewProps): React.ReactElement {
  const { labels } = useLabels()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)

  const label = labels.find((l) => l.id === labelId)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      // Fetch tasks that have this label
      const labelTasks = await window.api.tasks.getByLabel(labelId)
      setTasks(labelTasks)
    } catch (err) {
      console.error('Failed to fetch label tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [labelId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleCreateTask = async (content: string, dueDate?: string) => {
    await window.api.tasks.create({
      content,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      labelIds: [labelId]
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

  if (!label) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Label not found</h1>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Hash className="w-6 h-6" style={{ color: label.color }} />
        <div>
          <h1 className="text-2xl font-bold">{label.name}</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
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

          {tasks.length === 0 && !showAddInput && (
            <div className="text-center py-12 text-muted-foreground">
              <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: label.color }} />
              <p>No tasks with this label</p>
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
