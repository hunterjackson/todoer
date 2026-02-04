import React, { useState, useRef, useEffect } from 'react'
import { Hash, Check, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useLabels } from '@hooks/useLabels'
import type { Label } from '@shared/types'

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
  const { labels } = useLabels()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id))

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
            <Hash className="w-4 h-4" />
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
              <Hash className="w-2.5 h-2.5" />
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
        <div className="absolute z-50 mt-1 w-56 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {labels.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No labels yet
            </div>
          ) : (
            <div className="py-1">
              {labels.map((label) => {
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
                    <Hash className="w-4 h-4" style={{ color: label.color }} />
                    <span className="flex-1">{label.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
