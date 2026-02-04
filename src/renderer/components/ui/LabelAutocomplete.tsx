import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Hash, Plus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useLabels } from '@hooks/useLabels'
import type { Label } from '@shared/types'

interface LabelAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onLabelSelect: (label: Label) => void
  onLabelCreate: (name: string) => Promise<Label>
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function LabelAutocomplete({
  value,
  onChange,
  onLabelSelect,
  onLabelCreate,
  placeholder = 'Task name',
  className,
  autoFocus
}: LabelAutocompleteProps): React.ReactElement {
  const { labels } = useLabels()
  const [showDropdown, setShowDropdown] = useState(false)
  const [hashPosition, setHashPosition] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter labels based on search term
  const filteredLabels = labels.filter((label) =>
    label.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Check if we should show "Create new label" option
  const showCreateOption = searchTerm.length > 0 &&
    !labels.some((l) => l.name.toLowerCase() === searchTerm.toLowerCase())

  const totalOptions = filteredLabels.length + (showCreateOption ? 1 : 0)

  // Reset selected index when options change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm])

  // Detect # character and start autocomplete
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0

    onChange(newValue)

    // Find the most recent # before cursor that's not part of an already-selected label
    let hashPos = -1
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (newValue[i] === '#') {
        hashPos = i
        break
      }
      if (newValue[i] === ' ') {
        break
      }
    }

    if (hashPos >= 0) {
      const term = newValue.substring(hashPos + 1, cursorPos)
      setHashPosition(hashPos)
      setSearchTerm(term)
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
      setHashPosition(null)
      setSearchTerm('')
    }
  }, [onChange])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, totalOptions - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (totalOptions > 0) {
          e.preventDefault()
          if (selectedIndex < filteredLabels.length) {
            selectLabel(filteredLabels[selectedIndex])
          } else if (showCreateOption) {
            createAndSelectLabel()
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        break
      case 'Tab':
        if (showDropdown && totalOptions > 0) {
          e.preventDefault()
          if (selectedIndex < filteredLabels.length) {
            selectLabel(filteredLabels[selectedIndex])
          } else if (showCreateOption) {
            createAndSelectLabel()
          }
        }
        break
    }
  }, [showDropdown, selectedIndex, totalOptions, filteredLabels, showCreateOption])

  const selectLabel = useCallback((label: Label) => {
    if (hashPosition === null) return

    // Replace #searchTerm with just # (label will be tracked separately)
    const before = value.substring(0, hashPosition)
    const cursorPos = inputRef.current?.selectionStart || value.length
    const after = value.substring(cursorPos)

    // Remove the #text and add the label via callback
    const newValue = before + after
    onChange(newValue.trim() ? newValue : before + after)

    onLabelSelect(label)
    setShowDropdown(false)
    setHashPosition(null)
    setSearchTerm('')

    // Focus back on input
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [hashPosition, value, onChange, onLabelSelect])

  const createAndSelectLabel = useCallback(async () => {
    if (!searchTerm.trim()) return

    try {
      const newLabel = await onLabelCreate(searchTerm.trim())
      selectLabel(newLabel)
    } catch (err) {
      console.error('Failed to create label:', err)
    }
  }, [searchTerm, onLabelCreate, selectLabel])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
      />

      {showDropdown && totalOptions > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {filteredLabels.map((label, index) => (
            <button
              key={label.id}
              type="button"
              onClick={() => selectLabel(label)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent',
                selectedIndex === index && 'bg-accent'
              )}
            >
              <Hash className="w-4 h-4" style={{ color: label.color }} />
              <span>{label.name}</span>
            </button>
          ))}

          {showCreateOption && (
            <button
              type="button"
              onClick={createAndSelectLabel}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent border-t',
                selectedIndex === filteredLabels.length && 'bg-accent'
              )}
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>Create "<strong>{searchTerm}</strong>"</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
