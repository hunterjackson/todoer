import React, { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useConfirmDelete } from '@renderer/hooks/useSettings'
import type { Label, LabelCreate, LabelUpdate } from '@shared/types'
import { LABEL_COLORS } from '@shared/types'

interface LabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  label?: Label | null // If provided, we're editing
  onSave: (data: LabelCreate | LabelUpdate) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function LabelDialog({
  open,
  onOpenChange,
  label,
  onSave,
  onDelete
}: LabelDialogProps): React.ReactElement | null {
  const [name, setName] = useState('')
  const [color, setColor] = useState(LABEL_COLORS[0])
  const [isFavorite, setIsFavorite] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const confirmDelete = useConfirmDelete()

  const isEditing = !!label

  useEffect(() => {
    if (label) {
      setName(label.name)
      setColor(label.color)
      setIsFavorite(label.isFavorite)
    } else {
      setName('')
      setColor(LABEL_COLORS[0])
      setIsFavorite(false)
    }
  }, [label, open])

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
        isFavorite
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!label || !onDelete) return

    if (await confirmDelete(`Are you sure you want to delete "${label.name}"?`)) {
      await onDelete(label.id)
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
            {isEditing ? 'Edit label' : 'Add label'}
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
              placeholder="Label name"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {LABEL_COLORS.map((c) => (
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
