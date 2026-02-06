import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Tag, FolderKanban } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useLabels } from '@hooks/useLabels'
import { useProjects } from '@hooks/useProjects'
import type { Label, Project } from '@shared/types'

type AutocompleteMode = 'label' | 'project' | null

interface FilterQueryAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function FilterQueryAutocomplete({
  value,
  onChange,
  placeholder = 'e.g., today & p1',
  className
}: FilterQueryAutocompleteProps): React.ReactElement {
  const { labels } = useLabels()
  const { projects } = useProjects()
  const [showDropdown, setShowDropdown] = useState(false)
  const [mode, setMode] = useState<AutocompleteMode>(null)
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // In filter syntax: # = project, @ = label
  const filteredItems = mode === 'project'
    ? projects.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : mode === 'label'
      ? labels.filter((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : []

  const totalOptions = filteredItems.length

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm, mode])

  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [showDropdown])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0

    onChange(newValue)

    // Find the most recent # or @ before cursor
    let triggerPos = -1
    let detectedMode: AutocompleteMode = null

    for (let i = cursorPos - 1; i >= 0; i--) {
      if (newValue[i] === '#') {
        triggerPos = i
        detectedMode = 'project' // # = project in filter syntax
        break
      }
      if (newValue[i] === '@') {
        triggerPos = i
        detectedMode = 'label' // @ = label in filter syntax
        break
      }
      if (newValue[i] === ' ' || newValue[i] === '(' || newValue[i] === '|' || newValue[i] === '&') {
        break
      }
    }

    if (triggerPos >= 0 && detectedMode) {
      const term = newValue.substring(triggerPos + 1, cursorPos)
      setTriggerPosition(triggerPos)
      setSearchTerm(term)
      setMode(detectedMode)
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
      setTriggerPosition(null)
      setSearchTerm('')
      setMode(null)
    }
  }, [onChange])

  const selectItem = useCallback((name: string) => {
    if (triggerPosition === null) return

    // Replace trigger+searchTerm with trigger+name
    const trigger = value[triggerPosition] // # or @
    const before = value.substring(0, triggerPosition)
    const cursorPos = inputRef.current?.selectionStart || value.length
    const after = value.substring(cursorPos)

    const newValue = before + trigger + name + after
    onChange(newValue)

    setShowDropdown(false)
    setTriggerPosition(null)
    setSearchTerm('')
    setMode(null)

    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = before.length + trigger.length + name.length
        inputRef.current.focus()
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [triggerPosition, value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || totalOptions === 0) return

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
      case 'Tab':
        e.preventDefault()
        if (mode === 'project') {
          selectItem((filteredItems[selectedIndex] as Project).name)
        } else if (mode === 'label') {
          selectItem((filteredItems[selectedIndex] as Label).name)
        }
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setShowDropdown(false)
        break
    }
  }, [showDropdown, selectedIndex, totalOptions, filteredItems, mode, selectItem])

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
      />

      {showDropdown && totalOptions > 0 && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999
          }}
        >
          {filteredItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(item.name)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent',
                selectedIndex === index && 'bg-accent'
              )}
            >
              {mode === 'project' ? (
                <FolderKanban className="w-4 h-4" style={{ color: (item as Project).color }} />
              ) : (
                <Tag className="w-4 h-4" style={{ color: (item as Label).color }} />
              )}
              <span>{item.name}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
