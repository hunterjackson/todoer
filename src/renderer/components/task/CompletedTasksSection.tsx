import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { TaskItem } from './TaskItem'
import type { Task } from '@shared/types'

interface CompletedTasksSectionProps {
  projectId?: string
  labelId?: string
  onUncomplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}

export function CompletedTasksSection({
  projectId,
  labelId,
  onUncomplete,
  onEdit,
  onDelete
}: CompletedTasksSectionProps): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(false)
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isExpanded) {
      fetchCompletedTasks()
    }
  }, [isExpanded, projectId, labelId])

  const fetchCompletedTasks = async () => {
    setLoading(true)
    try {
      let tasks: Task[]
      if (labelId) {
        // For label view, get completed tasks with this label
        const allTasks = await window.api.tasks.list({ completed: true })
        // Filter by label - would need to check labels for each task
        // For now, just get all completed tasks
        tasks = allTasks
      } else {
        tasks = await window.api.tasks.list({
          projectId: projectId || undefined,
          completed: true
        })
      }
      // Sort by completion date, most recent first
      tasks.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      // Limit to most recent 50
      setCompletedTasks(tasks.slice(0, 50))
    } catch (err) {
      console.error('Failed to fetch completed tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUncomplete = async (id: string) => {
    await onUncomplete(id)
    // Remove from local state
    setCompletedTasks((prev) => prev.filter((t) => t.id !== id))
  }

  if (completedTasks.length === 0 && !isExpanded) {
    return null
  }

  return (
    <div className="mt-8 border-t pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <CheckCircle2 className="w-4 h-4" />
        <span>Completed tasks</span>
        {!isExpanded && completedTasks.length > 0 && (
          <span className="text-xs">({completedTasks.length})</span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1">
          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Loading completed tasks...
            </div>
          ) : completedTasks.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No completed tasks yet
            </div>
          ) : (
            completedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={() => {}} // Already completed
                onUncomplete={handleUncomplete}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
