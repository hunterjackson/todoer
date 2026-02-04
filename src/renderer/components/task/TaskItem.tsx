import React, { useState, useEffect } from 'react'
import { Circle, CheckCircle2, Calendar, Flag, Trash2, Edit, Hash } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { Task, Priority, Label } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

interface TaskItemProps {
  task: Task
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  showProject?: boolean
}

export function TaskItem({
  task,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  showProject = false
}: TaskItemProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [labels, setLabels] = useState<Label[]>([])

  useEffect(() => {
    // Fetch labels for this task
    window.api.tasks.getLabels(task.id).then(setLabels).catch(console.error)
  }, [task.id])

  const handleToggleComplete = () => {
    if (task.completed) {
      onUncomplete(task.id)
    } else {
      setIsCompleting(true)
      setTimeout(() => {
        onComplete(task.id)
        setIsCompleting(false)
      }, 300)
    }
  }

  const priorityColor = PRIORITY_COLORS[task.priority as Priority]
  const isOverdue = task.dueDate && task.dueDate < Date.now() && !task.completed

  return (
    <div
      className={cn(
        'task-item group flex items-start gap-3 px-3 py-2 rounded-md hover:bg-accent/50',
        isCompleting && 'completing'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggleComplete}
        className="mt-0.5 flex-shrink-0 focus:outline-none"
      >
        {task.completed ? (
          <CheckCircle2
            className="w-5 h-5 text-muted-foreground"
            strokeWidth={1.5}
          />
        ) : (
          <Circle
            className="w-5 h-5 transition-colors hover:text-primary"
            style={{ color: priorityColor }}
            strokeWidth={1.5}
          />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm cursor-pointer',
            task.completed && 'line-through text-muted-foreground'
          )}
          onClick={() => onEdit(task)}
        >
          {task.content}
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {task.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              <Calendar className="w-3 h-3" />
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {task.priority < 4 && (
            <span
              className="flex items-center gap-0.5 text-xs"
              style={{ color: priorityColor }}
            >
              <Flag className="w-3 h-3" />
              P{task.priority}
            </span>
          )}

          {showProject && task.projectId && task.projectId !== 'inbox' && (
            <span className="text-xs text-muted-foreground">
              #{task.projectId}
            </span>
          )}

          {/* Labels */}
          {labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${label.color}20`,
                color: label.color
              }}
            >
              <Hash className="w-2.5 h-2.5" />
              {label.name}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex items-center gap-1 opacity-0 transition-opacity',
          isHovered && 'opacity-100'
        )}
      >
        <button
          onClick={() => onEdit(task)}
          className="p-1 rounded hover:bg-accent"
          title="Edit"
        >
          <Edit className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 rounded hover:bg-accent"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

function formatDueDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (dateOnly.getTime() === today.getTime()) {
    return 'Today'
  }
  if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'Tomorrow'
  }
  if (dateOnly < today) {
    const days = Math.ceil((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))
    return `${days}d overdue`
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}
