import React, { useState, useRef, useCallback } from 'react'
import { Plus, Flag, X, Tag, FolderKanban } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { DatePicker } from '@renderer/components/ui/DatePicker'
import { TaskContentAutocomplete } from '@renderer/components/ui/TaskContentAutocomplete'
import type { TaskCreate, Priority, Label, Project } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

interface TaskAddInputProps {
  onCreate?: (data: TaskCreate) => Promise<void>
  onSubmit?: (data: TaskCreate) => Promise<void>
  onCancel?: () => void
  projectId?: string
  autoFocus?: boolean
  placeholder?: string
}

export function TaskAddInput({
  onCreate,
  onSubmit,
  onCancel,
  projectId: initialProjectId,
  autoFocus = false,
  placeholder = 'Task name (#project @label)'
}: TaskAddInputProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(autoFocus)
  const [content, setContent] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [priority, setPriority] = useState<Priority>(4)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      if (onSubmit) {
        await onSubmit({
          content: content.trim(),
          dueDate: dueDate ? dueDate.getTime() : undefined,
          priority,
          projectId: selectedProject?.id || initialProjectId,
          labelIds: selectedLabels.map((l) => l.id)
        })
      } else if (onCreate) {
        await onCreate({
          content: content.trim(),
          dueDate: dueDate ? dueDate.getTime() : undefined,
          priority,
          projectId: selectedProject?.id || initialProjectId,
          labelIds: selectedLabels.map((l) => l.id)
        })
      }
      setContent('')
      setDueDate(null)
      setPriority(4)
      setSelectedLabels([])
      setSelectedProject(null)
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

  // Handle paste event to support multiple tasks
  const handlePaste = async (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    const lines = pastedText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

    // If multiple lines are pasted, create multiple tasks
    if (lines.length > 1 && onCreate) {
      e.preventDefault()
      setIsSubmitting(true)
      try {
        for (const line of lines) {
          await onCreate({
            content: line,
            priority,
            projectId: selectedProject?.id || initialProjectId,
            labelIds: selectedLabels.map((l) => l.id)
          })
        }
        setContent('')
        setDueDate(null)
        setPriority(4)
        setSelectedLabels([])
        setSelectedProject(null)
        if (!autoFocus) {
          setIsExpanded(false)
        }
      } finally {
        setIsSubmitting(false)
      }
    }
    // If single line or no onCreate, let default paste behavior work
  }

  const handleCancel = () => {
    setIsExpanded(false)
    setContent('')
    setDueDate(null)
    setPriority(4)
    setSelectedLabels([])
    setSelectedProject(null)
    onCancel?.()
  }

  const handleLabelSelect = useCallback((label: Label) => {
    setSelectedLabels((prev) => {
      // Don't add duplicate
      if (prev.some((l) => l.id === label.id)) return prev
      return [...prev, label]
    })
  }, [])

  const handleLabelRemove = useCallback((labelId: string) => {
    setSelectedLabels((prev) => prev.filter((l) => l.id !== labelId))
  }, [])

  const handleProjectSelect = useCallback((project: Project) => {
    setSelectedProject(project)
  }, [])

  const handleProjectRemove = useCallback(() => {
    setSelectedProject(null)
  }, [])

  if (!isExpanded && !autoFocus) {
    return (
      <button
        onClick={() => {
          setIsExpanded(true)
        }}
        className="flex items-center gap-2 px-3 py-2 w-full text-left text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Plus className="w-4 h-4 text-primary group-hover:text-primary" />
        <span className="text-sm">Add task</span>
      </button>
    )
  }

  return (
    <div ref={containerRef} className="border rounded-lg p-3 space-y-3 bg-background shadow-sm">
      {/* Content input with autocomplete */}
      <TaskContentAutocomplete
        value={content}
        onChange={setContent}
        onLabelSelect={handleLabelSelect}
        onProjectSelect={handleProjectSelect}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
        autoFocus={autoFocus || isExpanded}
      />

      {/* Selected labels and project chips */}
      {(selectedLabels.length > 0 || selectedProject) && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProject && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: `${selectedProject.color}20`, color: selectedProject.color }}
            >
              <FolderKanban className="w-3 h-3" />
              {selectedProject.name}
              <button
                type="button"
                onClick={handleProjectRemove}
                className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedLabels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: `${label.color}20`, color: label.color }}
            >
              <Tag className="w-3 h-3" />
              {label.name}
              <button
                type="button"
                onClick={() => handleLabelRemove(label.id)}
                className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

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
