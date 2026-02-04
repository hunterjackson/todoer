import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, Flag, X, Hash } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjects } from '@hooks/useProjects'
import { useLabels } from '@hooks/useLabels'
import { LabelAutocomplete } from '@renderer/components/ui/LabelAutocomplete'
import type { Priority, Label } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

interface QuickAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickAddModal({ open, onOpenChange }: QuickAddModalProps): React.ReactElement | null {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>(4)
  const [projectId, setProjectId] = useState<string>('inbox')
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { projects, refresh: refreshProjects } = useProjects()
  const { labels, createLabel, refresh: refreshLabels } = useLabels()

  // Refresh projects and labels when modal opens
  useEffect(() => {
    if (open) {
      refreshProjects()
      refreshLabels()
      setTimeout(() => inputRef.current?.focus(), 100)

      // Add global escape listener
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onOpenChange(false)
        }
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    } else {
      setContent('')
      setDescription('')
      setDueDate('')
      setPriority(4)
      setProjectId('inbox')
      setLabelIds([])
      setSelectedLabels([])
    }
  }, [open, onOpenChange, refreshProjects, refreshLabels])

  // Handle label selection from autocomplete
  const handleLabelSelect = useCallback((label: Label) => {
    if (!labelIds.includes(label.id)) {
      setLabelIds((prev) => [...prev, label.id])
      setSelectedLabels((prev) => [...prev, label])
    }
  }, [labelIds])

  // Handle creating new label
  const handleLabelCreate = useCallback(async (name: string): Promise<Label> => {
    const newLabel = await createLabel({ name, color: '#808080' })
    return newLabel
  }, [createLabel])

  // Remove a selected label
  const handleRemoveLabel = useCallback((labelId: string) => {
    setLabelIds((prev) => prev.filter((id) => id !== labelId))
    setSelectedLabels((prev) => prev.filter((l) => l.id !== labelId))
  }, [])

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await window.api.tasks.create({
        content: content.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        projectId,
        labelIds: labelIds.length > 0 ? labelIds : undefined
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-background rounded-lg shadow-xl border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-medium">Quick Add Task</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4" onKeyDown={handleKeyDown}>
          {/* Task content with label autocomplete */}
          <LabelAutocomplete
            value={content}
            onChange={setContent}
            onLabelSelect={handleLabelSelect}
            onLabelCreate={handleLabelCreate}
            placeholder="Task name (type # for labels)"
            className="w-full text-lg bg-transparent border-none outline-none placeholder:text-muted-foreground"
            autoFocus
          />

          {/* Selected labels */}
          {selectedLabels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color
                  }}
                >
                  <Hash className="w-3 h-3" />
                  {label.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(label.id)}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Description (optional) */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full h-20 text-sm bg-transparent border rounded-md p-2 outline-none resize-none placeholder:text-muted-foreground"
          />

          {/* Options */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Due date */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent cursor-pointer">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Due date"
                className="w-28 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>

            {/* Priority */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-md border">
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'p-1.5 rounded hover:bg-accent',
                    priority === p && 'bg-accent'
                  )}
                  title={`Priority ${p}`}
                >
                  <Flag
                    className="w-4 h-4"
                    style={{ color: PRIORITY_COLORS[p] }}
                    fill={priority === p ? PRIORITY_COLORS[p] : 'none'}
                  />
                </button>
              ))}
            </div>

            {/* Project */}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-md border text-sm bg-transparent cursor-pointer hover:bg-accent"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Enter</kbd> to save
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-md hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className={cn(
                'px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground',
                (!content.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? 'Adding...' : 'Add task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
