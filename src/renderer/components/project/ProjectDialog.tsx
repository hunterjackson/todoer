import React, { useState, useEffect } from 'react'
import { X, Check, Archive, ArchiveRestore, Copy } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useConfirmDelete } from '@renderer/hooks/useSettings'
import type { Project, ProjectCreate, ProjectUpdate } from '@shared/types'
import { PROJECT_COLORS } from '@shared/types'
import { getAvailableParentProjects } from './projectParentOptions'

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null // If provided, we're editing
  projects?: Project[] // Available projects for parent selection
  onSave: (data: ProjectCreate | ProjectUpdate) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onArchive?: (id: string, archived: boolean) => Promise<void>
  onDuplicate?: (id: string) => Promise<void>
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  projects = [],
  onSave,
  onDelete,
  onArchive,
  onDuplicate
}: ProjectDialogProps): React.ReactElement | null {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [parentId, setParentId] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const confirmDelete = useConfirmDelete()

  const isEditing = !!project

  // Get available parent projects (exclude self and descendants when editing)
  const availableParents = getAvailableParentProjects(projects, project?.id)

  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
      setColor(project.color)
      setParentId(project.parentId)
      setIsFavorite(project.isFavorite)
      setViewMode(project.viewMode)
    } else {
      setName('')
      setDescription('')
      setColor(PROJECT_COLORS[0])
      setParentId(null)
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
        description: description.trim() || null,
        color,
        parentId,
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

    if (await confirmDelete(`Are you sure you want to delete "${project.name}"?`)) {
      await onDelete(project.id)
      onOpenChange(false)
    }
  }

  const handleArchive = async () => {
    if (!project || !onArchive) return
    const willArchive = !project.archivedAt
    await onArchive(project.id, willArchive)
    onOpenChange(false)
  }

  const handleDuplicate = async () => {
    if (!project || !onDuplicate) return
    await onDuplicate(project.id)
    onOpenChange(false)
  }

  const isArchived = !!project?.archivedAt

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

          {/* Description input */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Parent project selector - always visible for discoverability */}
          <div>
            <label className="block text-sm font-medium mb-1">Parent project</label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={availableParents.length === 0}
            >
              <option value="">None (top-level project)</option>
              {availableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {availableParents.length === 0 && !isEditing && (
              <p className="text-xs text-muted-foreground mt-1">
                Create a project first to make this a sub-project.
              </p>
            )}
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
            <div className="flex gap-2">
              {isEditing && onDuplicate && (
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="px-3 py-1.5 text-sm hover:bg-accent rounded-md flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
              )}
              {isEditing && onArchive && (
                <button
                  type="button"
                  onClick={handleArchive}
                  className="px-3 py-1.5 text-sm hover:bg-accent rounded-md flex items-center gap-1"
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="w-4 h-4" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      Archive
                    </>
                  )}
                </button>
              )}
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md"
                >
                  Delete
                </button>
              )}
            </div>
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
