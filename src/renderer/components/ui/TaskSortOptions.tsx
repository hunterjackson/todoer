import React, { useState, useRef, useEffect } from 'react'
import { ArrowUpDown, Check, ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { Task } from '@shared/types'

export type SortField = 'default' | 'priority' | 'dueDate' | 'alphabetical' | 'dateAdded'
export type SortDirection = 'asc' | 'desc'
export type GroupBy = 'none' | 'priority' | 'project' | 'dueDate'

interface TaskSortOptionsProps {
  sortField: SortField
  sortDirection: SortDirection
  groupBy: GroupBy
  onSortChange: (field: SortField, direction: SortDirection) => void
  onGroupChange: (groupBy: GroupBy) => void
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'dateAdded', label: 'Date added' }
]

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
  { value: 'dueDate', label: 'Due date' }
]

export function TaskSortOptions({
  sortField,
  sortDirection,
  groupBy,
  onSortChange,
  onGroupChange
}: TaskSortOptionsProps): React.ReactElement {
  const [sortOpen, setSortOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortField)?.label || 'Default'
  const currentGroupLabel = GROUP_OPTIONS.find((o) => o.value === groupBy)?.label || 'None'

  return (
    <div className="flex items-center gap-2">
      {/* Sort dropdown */}
      <div className="relative" ref={sortRef}>
        <button
          onClick={() => setSortOpen(!sortOpen)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border hover:bg-accent"
        >
          <ArrowUpDown className="w-3 h-3" />
          Sort: {currentSortLabel}
          <ChevronDown className="w-3 h-3" />
        </button>

        {sortOpen && (
          <div className="absolute z-50 mt-1 w-40 bg-popover border rounded-md shadow-lg">
            <div className="py-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value, sortDirection)
                    setSortOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left',
                    sortField === option.value && 'bg-accent/50'
                  )}
                >
                  <span className="flex-1">{option.label}</span>
                  {sortField === option.value && <Check className="w-3 h-3 text-primary" />}
                </button>
              ))}
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')
                  setSortOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
              >
                <span className="flex-1">
                  {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                </span>
                <span className="text-muted-foreground">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Group dropdown */}
      <div className="relative" ref={groupRef}>
        <button
          onClick={() => setGroupOpen(!groupOpen)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border hover:bg-accent"
        >
          Group: {currentGroupLabel}
          <ChevronDown className="w-3 h-3" />
        </button>

        {groupOpen && (
          <div className="absolute z-50 mt-1 w-36 bg-popover border rounded-md shadow-lg">
            <div className="py-1">
              {GROUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onGroupChange(option.value)
                    setGroupOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left',
                    groupBy === option.value && 'bg-accent/50'
                  )}
                >
                  <span className="flex-1">{option.label}</span>
                  {groupBy === option.value && <Check className="w-3 h-3 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Utility function to sort tasks
export function sortTasks(tasks: Task[], sortField: SortField, sortDirection: SortDirection): Task[] {
  const sorted = [...tasks]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sortField) {
      case 'priority':
        comparison = a.priority - b.priority
        break
      case 'dueDate': {
        const aDate = a.dueDate ?? Number.MAX_SAFE_INTEGER
        const bDate = b.dueDate ?? Number.MAX_SAFE_INTEGER
        comparison = aDate - bDate
        break
      }
      case 'alphabetical':
        comparison = a.content.localeCompare(b.content)
        break
      case 'dateAdded':
        comparison = a.createdAt - b.createdAt
        break
      default:
        comparison = a.sortOrder - b.sortOrder
    }

    return sortDirection === 'desc' ? -comparison : comparison
  })

  return sorted
}

// Utility function to group tasks
export function groupTasks(
  tasks: Task[],
  groupBy: GroupBy,
  projects?: { id: string; name: string; color: string }[]
): { key: string; label: string; tasks: Task[]; color?: string }[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: '', tasks }]
  }

  const groups = new Map<string, Task[]>()

  for (const task of tasks) {
    let key: string

    switch (groupBy) {
      case 'priority':
        key = `p${task.priority}`
        break
      case 'project':
        key = task.projectId || 'inbox'
        break
      case 'dueDate':
        if (!task.dueDate) {
          key = 'no-date'
        } else {
          const date = new Date(task.dueDate)
          key = date.toISOString().split('T')[0]
        }
        break
      default:
        key = 'all'
    }

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(task)
  }

  // Convert to array and add labels
  const result: { key: string; label: string; tasks: Task[]; color?: string }[] = []

  for (const [key, groupTasks] of groups) {
    let label: string
    let color: string | undefined

    switch (groupBy) {
      case 'priority': {
        const priorityLabels: Record<string, string> = {
          p1: 'Priority 1',
          p2: 'Priority 2',
          p3: 'Priority 3',
          p4: 'Priority 4'
        }
        const priorityColors: Record<string, string> = {
          p1: '#d1453b',
          p2: '#eb8909',
          p3: '#246fe0',
          p4: '#808080'
        }
        label = priorityLabels[key] || key
        color = priorityColors[key]
        break
      }
      case 'project': {
        if (key === 'inbox') {
          label = 'Inbox'
        } else {
          const project = projects?.find((p) => p.id === key)
          label = project?.name || key
          color = project?.color
        }
        break
      }
      case 'dueDate': {
        if (key === 'no-date') {
          label = 'No date'
        } else {
          const date = new Date(key)
          const today = new Date()
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)

          if (date.toDateString() === today.toDateString()) {
            label = 'Today'
          } else if (date.toDateString() === tomorrow.toDateString()) {
            label = 'Tomorrow'
          } else {
            label = date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })
          }
        }
        break
      }
      default:
        label = ''
    }

    result.push({ key, label, tasks: groupTasks, color })
  }

  // Sort groups
  result.sort((a, b) => {
    if (groupBy === 'priority') {
      return a.key.localeCompare(b.key)
    }
    if (groupBy === 'dueDate') {
      if (a.key === 'no-date') return 1
      if (b.key === 'no-date') return -1
      return a.key.localeCompare(b.key)
    }
    return a.label.localeCompare(b.label)
  })

  return result
}
