import React, { useState, useRef } from 'react'
import { Plus, Flag } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { DatePicker } from '@renderer/components/ui/DatePicker'
import type { TaskCreate, Priority } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

interface TaskAddInputProps {
  onCreate?: (data: TaskCreate) => Promise<void>
  onSubmit?: (content: string, dueDate?: string) => Promise<void>
  onCancel?: () => void
  projectId?: string
  autoFocus?: boolean
  placeholder?: string
}

export function TaskAddInput({
  onCreate,
  onSubmit,
  onCancel,
  projectId,
  autoFocus = false,
  placeholder = 'Task name'
}: TaskAddInputProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(autoFocus)
  const [content, setContent] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [priority, setPriority] = useState<Priority>(4)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      if (onSubmit) {
        await onSubmit(content.trim(), dueDate ? dueDate.toISOString() : undefined)
      } else if (onCreate) {
        await onCreate({
          content: content.trim(),
          dueDate: dueDate ? dueDate.getTime() : undefined,
          priority,
          projectId
        })
      }
      setContent('')
      setDueDate(null)
      setPriority(4)
      if (!autoFocus) {
        setIsExpanded(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleCancel = () => {
    setIsExpanded(false)
    setContent('')
    setDueDate(null)
    setPriority(4)
    onCancel?.()
  }

  if (!isExpanded && !autoFocus) {
    return (
      <button
        onClick={() => {
          setIsExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex items-center gap-2 px-3 py-2 w-full text-left text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Plus className="w-4 h-4 text-primary group-hover:text-primary" />
        <span className="text-sm">Add task</span>
      </button>
    )
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-background shadow-sm">
      {/* Content input */}
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
        autoFocus={autoFocus || isExpanded}
      />

      {/* Options row */}
      <div className="flex items-center gap-2">
        {/* Due date picker */}
        <DatePicker
          value={dueDate}
          onChange={setDueDate}
          placeholder="Due date"
        />

        {/* Priority selector */}
        <div className="flex items-center gap-0.5">
          {([1, 2, 3, 4] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                'p-1.5 rounded hover:bg-accent',
                priority === p && 'bg-accent'
              )}
              title={`Priority ${p}`}
            >
              <Flag
                className="w-3.5 h-3.5"
                style={{ color: PRIORITY_COLORS[p] }}
                fill={priority === p ? PRIORITY_COLORS[p] : 'none'}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 text-sm rounded hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className={cn(
            'px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground',
            (!content.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isSubmitting ? 'Adding...' : 'Add task'}
        </button>
      </div>
    </div>
  )
}
