import React, { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { Project, ProjectCreate, ProjectUpdate } from '@shared/types'
import { PROJECT_COLORS } from '@shared/types'

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null // If provided, we're editing
  onSave: (data: ProjectCreate | ProjectUpdate) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSave,
  onDelete
}: ProjectDialogProps): React.ReactElement | null {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [isFavorite, setIsFavorite] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!project

  useEffect(() => {
    if (project) {
      setName(project.name)
      setColor(project.color)
      setIsFavorite(project.isFavorite)
      setViewMode(project.viewMode)
    } else {
      setName('')
      setColor(PROJECT_COLORS[0])
      setIsFavorite(false)
      setViewMode('list')
    }
  }, [project, open])

  // Global escape listener
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onOpenChange(false)
        }
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onOpenChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        color,
        isFavorite,
        viewMode
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!project || !onDelete) return

    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
      await onDelete(project.id)
      onOpenChange(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit project' : 'Add project'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name input */}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-transform',
                    color === c && 'ring-2 ring-offset-2 ring-primary scale-110'
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && (
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* View mode */}
          <div>
            <label className="block text-sm font-medium mb-2">View</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent'
                )}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md',
                  viewMode === 'board'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent'
                )}
              >
                Board
              </button>
            </div>
          </div>

          {/* Favorite toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="favorite"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="favorite" className="text-sm">
              Add to favorites
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md"
              >
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm rounded-md hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className={cn(
                  'px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground',
                  (!name.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
