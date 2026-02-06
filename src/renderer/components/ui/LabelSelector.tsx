import React, { useState, useRef, useEffect } from 'react'
import { Tag, Check, X, Plus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useLabels, notifyLabelsChanged } from '@hooks/useLabels'
import { PROJECT_COLORS } from '@shared/types'

interface LabelSelectorProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

export function LabelSelector({
  selectedIds,
  onChange,
  placeholder = 'Add labels'
}: LabelSelectorProps): React.ReactElement {
  const { labels, createLabel } = useLabels()
  const [isOpen, setIsOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id))
  const filteredLabels = newLabelName
    ? labels.filter((l) => l.name.toLowerCase().includes(newLabelName.toLowerCase()))
    : labels

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const toggleLabel = (labelId: string) => {
    if (selectedIds.includes(labelId)) {
      onChange(selectedIds.filter((id) => id !== labelId))
    } else {
      onChange([...selectedIds, labelId])
    }
  }

  const removeLabel = (labelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedIds.filter((id) => id !== labelId))
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim() || isCreating) return

    // Check if label already exists
    const existingLabel = labels.find(
      (l) => l.name.toLowerCase() === newLabelName.trim().toLowerCase()
    )
    if (existingLabel) {
      // If exists, just select it
      if (!selectedIds.includes(existingLabel.id)) {
        onChange([...selectedIds, existingLabel.id])
      }
      setNewLabelName('')
      return
    }

    setIsCreating(true)
    try {
      // Create with random color from project colors
      const randomColor = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
      const newLabel = await createLabel({
        name: newLabelName.trim(),
        color: randomColor
      })
      // Add new label to selection
      onChange([...selectedIds, newLabel.id])
      setNewLabelName('')
      // Notify other components (sidebar) to refresh their label lists
      notifyLabelsChanged()
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreateLabel()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex flex-wrap items-center gap-1 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-accent min-h-[32px]',
          isOpen && 'ring-2 ring-ring'
        )}
      >
        {selectedLabels.length === 0 ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Tag className="w-4 h-4" />
            {placeholder}
          </span>
        ) : (
          selectedLabels.map((label) => (
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
              <button
                onClick={(e) => removeLabel(label.id, e)}
                className="ml-0.5 hover:bg-black/10 rounded"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-56 bg-popover border rounded-md shadow-lg max-h-72 overflow-hidden flex flex-col">
          {/* Create new label input */}
          <div className="p-2 border-b">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search or create label..."
                className="flex-1 px-2 py-1 text-sm bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {newLabelName.trim() && !labels.some((l) => l.name.toLowerCase() === newLabelName.trim().toLowerCase()) && (
                <button
                  onClick={handleCreateLabel}
                  disabled={isCreating}
                  className="p-1 rounded hover:bg-accent text-primary"
                  title="Create new label"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            {newLabelName.trim() && !labels.some((l) => l.name.toLowerCase() === newLabelName.trim().toLowerCase()) && (
              <p className="text-xs text-muted-foreground mt-1">
                Press Enter to create &quot;{newLabelName.trim()}&quot;
              </p>
            )}
          </div>

          {/* Labels list */}
          <div className="overflow-y-auto flex-1">
            {filteredLabels.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {labels.length === 0 ? 'No labels yet' : 'No matching labels'}
              </div>
            ) : (
              <div className="py-1">
                {filteredLabels.map((label) => {
                  const isSelected = selectedIds.includes(label.id)
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left',
                        isSelected && 'bg-accent/50'
                      )}
                    >
                      <Tag className="w-4 h-4" style={{ color: label.color }} />
                      <span className="flex-1">{label.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
