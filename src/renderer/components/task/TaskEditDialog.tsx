import React, { useState, useEffect, useCallback } from 'react'
import { X, Flag, Clock } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { DatePicker } from '@renderer/components/ui/DatePicker'
import { LabelSelector } from '@renderer/components/ui/LabelSelector'
import { TaskContentAutocomplete } from '@renderer/components/ui/TaskContentAutocomplete'
import { TaskComments } from './TaskComments'
import { useProjects, notifyProjectsChanged } from '@hooks/useProjects'
import { useLabels, notifyLabelsChanged } from '@hooks/useLabels'
import type { Task, TaskUpdate, Priority, Label, Project } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

interface TaskEditDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: TaskUpdate) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  onSave,
  onDelete
}: TaskEditDialogProps): React.ReactElement | null {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [priority, setPriority] = useState<Priority>(4)
  const [projectId, setProjectId] = useState<string>('inbox')
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [duration, setDuration] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { projects, refresh: refreshProjects } = useProjects()
  const { createLabel } = useLabels()

  // Refresh projects list when dialog opens to catch newly created projects
  useEffect(() => {
    if (open) {
      refreshProjects()
    }
  }, [open, refreshProjects])

  useEffect(() => {
    if (task) {
      setContent(task.content)
      setDescription(task.description || '')
      setDueDate(task.dueDate ? new Date(task.dueDate) : null)
      setDeadline(task.deadline ? new Date(task.deadline) : null)
      setPriority(task.priority as Priority)
      setProjectId(task.projectId || 'inbox')
      setDuration(task.duration)

      // Fetch labels for task
      window.api.tasks.getLabels(task.id).then((labels: Label[]) => {
        setLabelIds(labels.map((l) => l.id))
      }).catch(console.error)
    }
  }, [task])

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

  // Handle label selection from inline autocomplete
  const handleLabelSelect = useCallback((label: Label) => {
    if (!labelIds.includes(label.id)) {
      setLabelIds((prev) => [...prev, label.id])
    }
  }, [labelIds])

  // Handle creating new label from inline autocomplete
  const handleLabelCreate = useCallback(async (name: string): Promise<Label> => {
    const newLabel = await createLabel({ name, color: '#808080' })
    // Notify sidebar to refresh labels
    notifyLabelsChanged()
    return newLabel
  }, [createLabel])

  // Handle project selection from inline autocomplete
  const handleProjectSelect = useCallback((project: Project) => {
    setProjectId(project.id)
  }, [])

  // Handle creating new project from inline autocomplete
  const handleProjectCreate = useCallback(async (name: string): Promise<Project> => {
    const newProject = await window.api.projects.create({ name, color: '#808080' })
    await refreshProjects()
    // Notify sidebar to refresh projects
    notifyProjectsChanged()
    return newProject
  }, [refreshProjects])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task || !content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Clear sectionId when moving to a different project
      // (sections are project-specific)
      const shouldClearSection = projectId !== task.projectId

      await onSave(task.id, {
        content: content.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate ? dueDate.getTime() : null,
        deadline: deadline ? deadline.getTime() : null,
        priority,
        projectId,
        sectionId: shouldClearSection ? null : undefined,
        labelIds,
        duration
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!task || !onDelete) return

    if (confirm(`Are you sure you want to delete "${task.content}"?`)) {
      await onDelete(task.id)
      onOpenChange(false)
    }
  }

  if (!open || !task) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit task</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Content input with inline autocomplete */}
          <div>
            <label className="block text-sm font-medium mb-1">Task name</label>
            <TaskContentAutocomplete
              value={content}
              onChange={setContent}
              onLabelSelect={handleLabelSelect}
              onLabelCreate={handleLabelCreate}
              onProjectSelect={handleProjectSelect}
              onProjectCreate={handleProjectCreate}
              placeholder="Task name (#label @project)"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Project selector */}
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium mb-1">Labels</label>
            <LabelSelector
              selectedIds={labelIds}
              onChange={setLabelIds}
              placeholder="Add labels"
            />
          </div>

          {/* Options row */}
          <div className="flex flex-wrap items-start gap-4">
            {/* Due date picker */}
            <div>
              <label className="block text-sm font-medium mb-1">Due date</label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="No due date"
              />
            </div>

            {/* Deadline picker */}
            <div>
              <label className="block text-sm font-medium mb-1">Deadline</label>
              <DatePicker
                value={deadline}
                onChange={setDeadline}
                placeholder="No deadline"
              />
            </div>

            {/* Priority selector */}
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <div className="flex items-center gap-0.5">
                {([1, 2, 3, 4] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'p-1.5 rounded hover:bg-accent',
                      priority === p && 'bg-accent'
                    )}
                    title={`Priority ${p}`}
                  >
                    <Flag
                      className="w-4 h-4"
                      style={{ color: PRIORITY_COLORS[p] }}
                      fill={priority === p ? PRIORITY_COLORS[p] : 'none'}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium mb-1">Duration</label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  value={duration ?? ''}
                  onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="0"
                  className="w-16 px-2 py-1 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="pt-4 border-t">
            <TaskComments taskId={task.id} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md"
              >
                Delete task
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
                disabled={!content.trim() || isSubmitting}
                className={cn(
                  'px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground',
                  (!content.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
