import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, Flag, Clock, Plus, CheckCircle2, Circle, Check, Paperclip, Download, Trash2, FileText, UserCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { DatePicker } from '@renderer/components/ui/DatePicker'
import { LabelSelector } from '@renderer/components/ui/LabelSelector'
import { TaskContentAutocomplete } from '@renderer/components/ui/TaskContentAutocomplete'
import { TaskComments } from './TaskComments'
import { RichTextEditor } from '@renderer/components/ui/RichTextEditor'
import { useProjects, notifyProjectsChanged } from '@hooks/useProjects'
import { useLabels, notifyLabelsChanged } from '@hooks/useLabels'
import { useConfirmDelete } from '@hooks/useSettings'
import type { Task, TaskCreate, TaskUpdate, Priority, Label, Project } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

interface TaskEditDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: TaskUpdate) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreateSubtask?: (data: TaskCreate) => Promise<void>
  onEditTask?: (task: Task) => void
}

export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onCreateSubtask,
  onEditTask
}: TaskEditDialogProps): React.ReactElement | null {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [priority, setPriority] = useState<Priority>(4)
  const [projectId, setProjectId] = useState<string>('inbox')
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [duration, setDuration] = useState<number | null>(null)
  const [delegatedTo, setDelegatedTo] = useState<string>('')
  const [delegatedUserSuggestions, setDelegatedUserSuggestions] = useState<string[]>([])
  const [showDelegatedSuggestions, setShowDelegatedSuggestions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [newSubtaskContent, setNewSubtaskContent] = useState('')
  const [attachments, setAttachments] = useState<{ id: string; filename: string; mimeType: string; size: number }[]>([])
  const [showNewProjectInput, setShowNewProjectInput] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const { projects, refresh: refreshProjects } = useProjects()
  const { createLabel } = useLabels()
  const confirmDelete = useConfirmDelete()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoad = useRef(true)
  const lastSavedData = useRef<string>('')

  // Refresh projects list and delegated users when dialog opens
  useEffect(() => {
    if (open) {
      refreshProjects()
      window.api.delegatedUsers.list().then(setDelegatedUserSuggestions).catch(() => {})
    }
  }, [open, refreshProjects])

  // Fetch subtasks when dialog opens
  const fetchSubtasks = useCallback(async () => {
    if (!task) return
    try {
      const allTasks = await window.api.tasks.list({ projectId: task.projectId })
      const children = allTasks.filter((t: Task) => t.parentId === task.id && !t.completedAt)
      setSubtasks(children)
    } catch {
      setSubtasks([])
    }
  }, [task])

  const fetchAttachments = useCallback(async () => {
    if (!task) return
    try {
      const list = await window.api.attachments.list(task.id)
      setAttachments(list)
    } catch {
      setAttachments([])
    }
  }, [task])

  useEffect(() => {
    if (open && task) {
      fetchSubtasks()
      fetchAttachments()
    }
  }, [open, task, fetchSubtasks, fetchAttachments])

  const handleAddSubtask = async () => {
    if (!task || !newSubtaskContent.trim()) return
    try {
      await window.api.tasks.create({
        content: newSubtaskContent.trim(),
        parentId: task.id,
        projectId: task.projectId
      })
      setNewSubtaskContent('')
      setShowSubtaskInput(false)
      await fetchSubtasks()
      onCreateSubtask?.({ content: newSubtaskContent.trim(), parentId: task.id, projectId: task.projectId })
    } catch {
      // Subtask creation failed silently - UI won't update
    }
  }

  const handleCompleteSubtask = async (subtaskId: string) => {
    try {
      await window.api.tasks.complete(subtaskId)
      await fetchSubtasks()
    } catch {
      // Subtask completion failed silently
    }
  }

  useEffect(() => {
    if (task) {
      setContent(task.content)
      setDescription(task.description || '')
      setDueDate(task.dueDate ? new Date(task.dueDate) : null)
      setDeadline(task.deadline ? new Date(task.deadline) : null)
      setPriority(task.priority as Priority)
      setProjectId(task.projectId || 'inbox')
      setDuration(task.duration)
      setDelegatedTo(task.delegatedTo || '')

      // Fetch labels for task
      window.api.tasks.getLabels(task.id).then((labels: Label[]) => {
        setLabelIds(labels.map((l) => l.id))
      }).catch(() => {
        // Silently handle label fetch errors - labels will default to empty
      })
    }
  }, [task])

  // Build save data for comparison and autosave
  const buildSaveData = useCallback(() => {
    if (!task) return null
    const shouldClearSection = projectId !== task.projectId
    return {
      content: content.trim(),
      description: description.trim() || null,
      dueDate: dueDate ? dueDate.getTime() : null,
      deadline: deadline ? deadline.getTime() : null,
      priority,
      projectId,
      sectionId: shouldClearSection ? null : undefined,
      labelIds,
      duration,
      delegatedTo: delegatedTo.trim() || null
    }
  }, [task, content, description, dueDate, deadline, priority, projectId, labelIds, duration, delegatedTo])

  // Autosave with debounce
  const performAutoSave = useCallback(async () => {
    if (!task || !content.trim()) return
    const data = buildSaveData()
    if (!data) return

    const dataStr = JSON.stringify(data)
    if (dataStr === lastSavedData.current) return

    setSaveStatus('saving')
    try {
      await onSave(task.id, data)
      lastSavedData.current = dataStr
      setSaveStatus('saved')
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [task, content, buildSaveData, onSave])

  // Trigger autosave on field changes (debounced)
  useEffect(() => {
    if (isInitialLoad.current || !task || !open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performAutoSave()
    }, 800)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [content, description, dueDate, deadline, priority, projectId, labelIds, duration, delegatedTo, performAutoSave, task, open])

  // Mark initial load complete after all fields are set
  useEffect(() => {
    if (task && open) {
      // Set initial load flag after a tick to allow all state setters to complete
      isInitialLoad.current = true
      const timer = setTimeout(() => {
        const data = buildSaveData()
        if (data) lastSavedData.current = JSON.stringify(data)
        isInitialLoad.current = false
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [task?.id, open])

  // Flush autosave on close
  useEffect(() => {
    if (!open && debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [open])

  // Global escape listener
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          // Flush any pending autosave immediately
          if (debounceRef.current) {
            clearTimeout(debounceRef.current)
            debounceRef.current = null
            performAutoSave()
          }
          onOpenChange(false)
        }
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onOpenChange, performAutoSave])

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

    // Flush pending autosave and close
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setIsSubmitting(true)
    try {
      await performAutoSave()
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!task || !onDelete) return

    if (await confirmDelete(`Are you sure you want to delete "${task.content}"?`)) {
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
        onClick={() => {
          // Flush pending autosave before closing
          if (debounceRef.current) {
            clearTimeout(debounceRef.current)
            debounceRef.current = null
            performAutoSave()
          }
          onOpenChange(false)
        }}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit task</h2>
          <button
            onClick={() => {
              if (debounceRef.current) {
                clearTimeout(debounceRef.current)
                debounceRef.current = null
                performAutoSave()
              }
              onOpenChange(false)
            }}
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
              placeholder="Task name (#project @label)"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Add a description..."
              minHeight="60px"
            />
          </div>

          {/* Project selector */}
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            {showNewProjectInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      if (newProjectName.trim()) {
                        const newProject = await handleProjectCreate(newProjectName.trim())
                        setProjectId(newProject.id)
                        setNewProjectName('')
                        setShowNewProjectInput(false)
                      }
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      e.stopPropagation()
                      setNewProjectName('')
                      setShowNewProjectInput(false)
                    }
                  }}
                  placeholder="New project name"
                  className="flex-1 px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (newProjectName.trim()) {
                      const newProject = await handleProjectCreate(newProjectName.trim())
                      setProjectId(newProject.id)
                      setNewProjectName('')
                      setShowNewProjectInput(false)
                    }
                  }}
                  disabled={!newProjectName.trim()}
                  className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setNewProjectName(''); setShowNewProjectInput(false) }}
                  className="px-3 py-2 text-sm rounded-md hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => {
                  if (e.target.value === '__create_new__') {
                    setShowNewProjectInput(true)
                    // Reset select to current project so it doesn't show "+ Create new project"
                    e.target.value = projectId
                  } else {
                    setProjectId(e.target.value)
                  }
                }}
                className="w-full px-3 py-2 border rounded-md bg-background cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="__create_new__">+ Create new project</option>
              </select>
            )}
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

          {/* Delegated to */}
          <div>
            <label className="block text-sm font-medium mb-1">Delegated to</label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={delegatedTo}
                  onChange={(e) => {
                    setDelegatedTo(e.target.value)
                    setShowDelegatedSuggestions(e.target.value.length > 0)
                  }}
                  onFocus={() => {
                    if (delegatedUserSuggestions.length > 0) {
                      setShowDelegatedSuggestions(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowDelegatedSuggestions(false), 200)
                  }}
                  placeholder="Person name"
                  className="flex-1 px-3 py-1.5 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {delegatedTo && (
                  <button
                    type="button"
                    onClick={() => setDelegatedTo('')}
                    className="p-1 rounded hover:bg-accent"
                    title="Clear delegation"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {showDelegatedSuggestions && delegatedUserSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-background border rounded-md shadow-lg max-h-32 overflow-y-auto">
                  {delegatedUserSuggestions
                    .filter(name => name.toLowerCase().includes(delegatedTo.toLowerCase()))
                    .map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setDelegatedTo(name)
                          setShowDelegatedSuggestions(false)
                        }}
                      >
                        {name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Subtasks ({subtasks.length})
              </span>
              <button
                type="button"
                onClick={() => setShowSubtaskInput(true)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
              >
                <Plus className="w-3.5 h-3.5" />
                Add subtask
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1 mb-2">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group/subtask">
                    <button
                      type="button"
                      onClick={() => handleCompleteSubtask(subtask.id)}
                      className="text-muted-foreground hover:text-primary flex-shrink-0"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <span
                      className={cn(
                        "text-sm truncate",
                        onEditTask && "cursor-pointer hover:text-primary hover:underline"
                      )}
                      onClick={() => onEditTask?.(subtask)}
                      role={onEditTask ? "button" : undefined}
                      tabIndex={onEditTask ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (onEditTask && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          onEditTask(subtask)
                        }
                      }}
                    >
                      {subtask.content}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showSubtaskInput && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newSubtaskContent}
                  onChange={(e) => setNewSubtaskContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      handleAddSubtask()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setShowSubtaskInput(false)
                      setNewSubtaskContent('')
                    }
                  }}
                  placeholder="Subtask name"
                  className="flex-1 px-3 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskContent.trim()}
                  className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSubtaskInput(false); setNewSubtaskContent('') }}
                  className="px-3 py-1.5 text-sm rounded-md hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Paperclip className="w-4 h-4" />
                Attachments ({attachments.length})
              </span>
              <button
                type="button"
                onClick={async () => {
                  const result = await window.api.attachments.add(task.id)
                  if (result) {
                    await fetchAttachments()
                  }
                }}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
              >
                <Plus className="w-3.5 h-3.5" />
                Attach file
              </button>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group/att cursor-pointer"
                    onClick={() => window.api.attachments.open(att.id)}
                    title="Click to open"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{att.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {att.size < 1024 ? `${att.size}B` : att.size < 1024 * 1024 ? `${Math.round(att.size / 1024)}KB` : `${(att.size / 1024 / 1024).toFixed(1)}MB`}
                    </span>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await window.api.attachments.download(att.id)
                      }}
                      className="p-1 rounded hover:bg-accent opacity-0 group-hover/att:opacity-100"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await window.api.attachments.delete(att.id)
                        await fetchAttachments()
                      }}
                      className="p-1 rounded hover:bg-destructive/10 opacity-0 group-hover/att:opacity-100"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            <div className="flex items-center gap-3">
              {/* Autosave status indicator */}
              {saveStatus === 'saving' && (
                <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (debounceRef.current) {
                    clearTimeout(debounceRef.current)
                    debounceRef.current = null
                    performAutoSave()
                  }
                  onOpenChange(false)
                }}
                className="px-4 py-2 text-sm rounded-md hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
