import React, { useState, useEffect, useMemo } from 'react'
import { Circle, CheckCircle2, Calendar, Flag, Trash2, Edit, Tag, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSettings } from '@renderer/hooks/useSettings'
import type { Task, Priority, Label } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

// Convert URLs in text to clickable links
function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<>]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            window.open(part, '_blank')
          }}
          className="text-primary underline hover:text-primary/80"
          title={part}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

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
  const [projectName, setProjectName] = useState<string | null>(null)
  const { settings } = useSettings()

  useEffect(() => {
    // Fetch labels for this task
    window.api.tasks.getLabels(task.id).then(setLabels).catch(() => {})
  }, [task.id])

  useEffect(() => {
    // Fetch project name if showing project info
    if (showProject && task.projectId && task.projectId !== 'inbox') {
      window.api.projects.get(task.projectId).then((project) => {
        if (project) setProjectName(project.name)
      }).catch(() => {})
    }
  }, [showProject, task.projectId])

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
  // Compare against start of today (midnight) so same-day tasks aren't marked overdue
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const isOverdue = task.dueDate && task.dueDate < todayStart.getTime() && !task.completed
  const isDeadlinePast = task.deadline && task.deadline < todayStart.getTime() && !task.completed

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
          {linkifyText(task.content)}
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
              {formatDueDate(task.dueDate, settings.dateFormat)}
            </span>
          )}

          {task.deadline && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                isDeadlinePast ? 'text-destructive font-medium' : 'text-orange-500'
              )}
              title="Deadline"
            >
              <AlertCircle className="w-3 h-3" />
              {formatDueDate(task.deadline, settings.dateFormat)}
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

          {task.duration && task.duration > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatDuration(task.duration)}
            </span>
          )}

          {showProject && task.projectId && task.projectId !== 'inbox' && projectName && (
            <span className="text-xs text-muted-foreground">
              {projectName}
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
              <Tag className="w-2.5 h-2.5" />
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

function formatDueDate(timestamp: number, dateFormat: 'mdy' | 'dmy' | 'ymd' = 'mdy'): string {
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
  const day = date.getDate()
  const mon = months[date.getMonth()]

  switch (dateFormat) {
    case 'dmy':
      return `${day} ${mon}`
    case 'ymd':
      return `${mon} ${day}`
    default: // mdy
      return `${mon} ${day}`
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${remainingMinutes}m`
}
