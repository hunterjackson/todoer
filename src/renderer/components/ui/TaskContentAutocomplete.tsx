import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Hash, FolderKanban, Plus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useLabels, notifyLabelsChanged } from '@hooks/useLabels'
import { useProjects, notifyProjectsChanged } from '@hooks/useProjects'
import type { Label, Project } from '@shared/types'

type AutocompleteMode = 'label' | 'project' | null

interface TaskContentAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onLabelSelect?: (label: Label) => void
  onLabelCreate?: (name: string) => Promise<Label>
  onProjectSelect?: (project: Project) => void
  onProjectCreate?: (name: string) => Promise<Project>
  onPaste?: (e: React.ClipboardEvent) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function TaskContentAutocomplete({
  value,
  onChange,
  onLabelSelect,
  onLabelCreate,
  onProjectSelect,
  onProjectCreate,
  onPaste,
  placeholder = 'Task name',
  className,
  autoFocus
}: TaskContentAutocompleteProps): React.ReactElement {
  const { labels, createLabel } = useLabels()
  const { projects, createProject } = useProjects()
  const [showDropdown, setShowDropdown] = useState(false)
  const [mode, setMode] = useState<AutocompleteMode>(null)
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter items based on mode and search term
  const filteredLabels = mode === 'label'
    ? labels.filter((label) =>
        label.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  const filteredProjects = mode === 'project'
    ? projects.filter((project) =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  // Check if we should show "Create new" option
  const showCreateOption = searchTerm.length > 0 && (
    (mode === 'label' && !labels.some((l) => l.name.toLowerCase() === searchTerm.toLowerCase())) ||
    (mode === 'project' && !projects.some((p) => p.name.toLowerCase() === searchTerm.toLowerCase()))
  )

  const totalOptions = (mode === 'label' ? filteredLabels.length : filteredProjects.length) + (showCreateOption ? 1 : 0)

  // Reset selected index when options change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm, mode])

  // Update dropdown position when showing
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

  // Detect # or @ character and start autocomplete
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
        detectedMode = 'label'
        break
      }
      if (newValue[i] === '@') {
        triggerPos = i
        detectedMode = 'project'
        break
      }
      if (newValue[i] === ' ') {
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
          if (mode === 'label') {
            if (selectedIndex < filteredLabels.length) {
              selectLabel(filteredLabels[selectedIndex])
            } else if (showCreateOption) {
              createAndSelectLabel()
            }
          } else if (mode === 'project') {
            if (selectedIndex < filteredProjects.length) {
              selectProject(filteredProjects[selectedIndex])
            } else if (showCreateOption) {
              createAndSelectProject()
            }
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
          if (mode === 'label') {
            if (selectedIndex < filteredLabels.length) {
              selectLabel(filteredLabels[selectedIndex])
            } else if (showCreateOption) {
              createAndSelectLabel()
            }
          } else if (mode === 'project') {
            if (selectedIndex < filteredProjects.length) {
              selectProject(filteredProjects[selectedIndex])
            } else if (showCreateOption) {
              createAndSelectProject()
            }
          }
        }
        break
    }
  }, [showDropdown, selectedIndex, totalOptions, filteredLabels, filteredProjects, mode, showCreateOption])

  const selectLabel = useCallback((label: Label) => {
    if (triggerPosition === null) return

    // Replace #searchTerm with empty (label will be tracked separately)
    const before = value.substring(0, triggerPosition)
    const cursorPos = inputRef.current?.selectionStart || value.length
    const after = value.substring(cursorPos)

    const newValue = before + after
    onChange(newValue.trim() ? newValue : before + after)

    onLabelSelect?.(label)
    setShowDropdown(false)
    setTriggerPosition(null)
    setSearchTerm('')
    setMode(null)

    setTimeout(() => inputRef.current?.focus(), 0)
  }, [triggerPosition, value, onChange, onLabelSelect])

  const selectProject = useCallback((project: Project) => {
    if (triggerPosition === null) return

    // Replace @searchTerm with empty (project will be tracked separately)
    const before = value.substring(0, triggerPosition)
    const cursorPos = inputRef.current?.selectionStart || value.length
    const after = value.substring(cursorPos)

    const newValue = before + after
    onChange(newValue.trim() ? newValue : before + after)

    onProjectSelect?.(project)
    setShowDropdown(false)
    setTriggerPosition(null)
    setSearchTerm('')
    setMode(null)

    setTimeout(() => inputRef.current?.focus(), 0)
  }, [triggerPosition, value, onChange, onProjectSelect])

  const createAndSelectLabel = useCallback(async () => {
    if (!searchTerm.trim()) return

    try {
      const newLabel = onLabelCreate
        ? await onLabelCreate(searchTerm.trim())
        : await createLabel({ name: searchTerm.trim(), color: '#808080' })
      selectLabel(newLabel)
      // Notify all label hooks (including sidebar) about the new label
      notifyLabelsChanged()
    } catch (err) {
      console.error('Failed to create label:', err)
    }
  }, [searchTerm, onLabelCreate, createLabel, selectLabel])

  const createAndSelectProject = useCallback(async () => {
    if (!searchTerm.trim()) return

    try {
      const newProject = onProjectCreate
        ? await onProjectCreate(searchTerm.trim())
        : await createProject({ name: searchTerm.trim(), color: '#808080' })
      selectProject(newProject)
      // Notify all project hooks (including sidebar) about the new project
      notifyProjectsChanged()
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }, [searchTerm, onProjectCreate, createProject, selectProject])

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
        onPaste={onPaste}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
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
          {mode === 'label' && filteredLabels.map((label, index) => (
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

          {mode === 'project' && filteredProjects.map((project, index) => (
            <button
              key={project.id}
              type="button"
              onClick={() => selectProject(project)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent',
                selectedIndex === index && 'bg-accent'
              )}
            >
              <FolderKanban className="w-4 h-4" style={{ color: project.color }} />
              <span>{project.name}</span>
            </button>
          ))}

          {showCreateOption && (
            <button
              type="button"
              onClick={mode === 'label' ? createAndSelectLabel : createAndSelectProject}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent border-t',
                selectedIndex === (mode === 'label' ? filteredLabels.length : filteredProjects.length) && 'bg-accent'
              )}
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>Create &quot;<strong>{searchTerm}</strong>&quot;</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
