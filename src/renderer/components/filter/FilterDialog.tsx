import React, { useState, useEffect } from 'react'
import { X, Check, HelpCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { FilterQueryAutocomplete } from '@renderer/components/ui/FilterQueryAutocomplete'
import type { Filter, FilterCreate, FilterUpdate } from '@shared/types'
import { PROJECT_COLORS } from '@shared/types'

interface FilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filter?: Filter | null // If provided, we're editing
  onSave: (data: FilterCreate | FilterUpdate) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function FilterDialog({
  open,
  onOpenChange,
  filter,
  onSave,
  onDelete
}: FilterDialogProps): React.ReactElement | null {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [isFavorite, setIsFavorite] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const isEditing = !!filter

  useEffect(() => {
    if (filter) {
      setName(filter.name)
      setQuery(filter.query)
      setColor(filter.color)
      setIsFavorite(filter.isFavorite)
    } else {
      setName('')
      setQuery('')
      setColor(PROJECT_COLORS[0])
      setIsFavorite(false)
    }
  }, [filter, open])

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
    if (!name.trim() || !query.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        query: query.trim(),
        color,
        isFavorite
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!filter || !onDelete) return

    if (confirm(`Are you sure you want to delete "${filter.name}"?`)) {
      await onDelete(filter.id)
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
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit filter' : 'Add filter'}
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
              placeholder="Filter name"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Query input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Query</label>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Help
              </button>
            </div>
            <FilterQueryAutocomplete
              value={query}
              onChange={setQuery}
              placeholder="e.g., today & p1 | #project | @label"
              className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Help panel */}
            {showHelp && (
              <div className="mt-2 p-3 bg-muted rounded-md text-xs space-y-2">
                <p className="font-medium">Supported query syntax:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li><code className="bg-background px-1 rounded">today</code> - Due today</li>
                  <li><code className="bg-background px-1 rounded">tomorrow</code> - Due tomorrow</li>
                  <li><code className="bg-background px-1 rounded">overdue</code> - Overdue tasks</li>
                  <li><code className="bg-background px-1 rounded">7 days</code> - Due in next 7 days</li>
                  <li><code className="bg-background px-1 rounded">no date</code> - Tasks without due date</li>
                  <li><code className="bg-background px-1 rounded">p1</code>, <code className="bg-background px-1 rounded">p2</code>, <code className="bg-background px-1 rounded">p3</code>, <code className="bg-background px-1 rounded">p4</code> - By priority</li>
                  <li><code className="bg-background px-1 rounded">#project</code> - By project name (type # for autocomplete)</li>
                  <li><code className="bg-background px-1 rounded">@label</code> - By label name (type @ for autocomplete)</li>
                  <li><code className="bg-background px-1 rounded">&</code> - AND (both conditions)</li>
                  <li><code className="bg-background px-1 rounded">|</code> - OR (either condition)</li>
                </ul>
                <p className="text-muted-foreground">Example: <code className="bg-background px-1 rounded">today & p1 | overdue</code></p>
              </div>
            )}
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.slice(0, 10).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-transform',
                    color === c && 'ring-2 ring-offset-2 ring-primary scale-110'
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
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
                disabled={!name.trim() || !query.trim() || isSubmitting}
                className={cn(
                  'px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground',
                  (!name.trim() || !query.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
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
