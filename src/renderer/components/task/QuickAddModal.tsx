import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, Flag, X, Tag, Clock, FolderKanban } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjects, notifyProjectsChanged } from '@hooks/useProjects'
import { useLabels, notifyLabelsChanged } from '@hooks/useLabels'
import { TaskContentAutocomplete } from '@renderer/components/ui/TaskContentAutocomplete'
import type { Priority, Label, Section, Project } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'
import { parseInlineTaskContent, findProjectByName, findLabelByName, findSectionByName } from '@shared/utils'

interface QuickAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskCreated?: () => void
}

export function QuickAddModal({ open, onOpenChange, onTaskCreated }: QuickAddModalProps): React.ReactElement | null {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>(4)
  const [projectId, setProjectId] = useState<string>('inbox')
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [allSections, setAllSections] = useState<Section[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const { projects, refresh: refreshProjects } = useProjects()
  const { labels, createLabel, refresh: refreshLabels } = useLabels()

  // Refresh projects, labels, and sections when modal opens
  useEffect(() => {
    if (open) {
      refreshProjects()
      refreshLabels()
      // Fetch all sections for inline parsing
      window.api.sections.listAll().then(setAllSections).catch(() => {})
      // Load default project setting, validating project still exists
      window.api.settings.get('defaultProject').then(async (defaultProject) => {
        if (defaultProject && defaultProject !== 'inbox') {
          // Verify the project still exists before using it
          const project = await window.api.projects.get(defaultProject)
          if (project) {
            setProjectId(defaultProject)
          }
        }
      }).catch(() => {})
      setTimeout(() => inputRef.current?.focus(), 100)

      // Add global escape listener
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onOpenChange(false)
        }
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    } else {
      setContent('')
      setDescription('')
      setDueDate('')
      setPriority(4)
      setProjectId('inbox')
      setSectionId(null)
      setDuration(null)
      setLabelIds([])
      setSelectedLabels([])
    }
  }, [open, onOpenChange, refreshProjects, refreshLabels])

  // Handle label selection from autocomplete
  const handleLabelSelect = useCallback((label: Label) => {
    if (!labelIds.includes(label.id)) {
      setLabelIds((prev) => [...prev, label.id])
      setSelectedLabels((prev) => [...prev, label])
    }
  }, [labelIds])

  // Handle creating new label
  const handleLabelCreate = useCallback(async (name: string): Promise<Label> => {
    const newLabel = await createLabel({ name, color: '#808080' })
    // Notify sidebar to refresh labels
    notifyLabelsChanged()
    return newLabel
  }, [createLabel])

  // Handle project selection from autocomplete
  const handleProjectSelect = useCallback((project: Project) => {
    setProjectId(project.id)
  }, [])

  // Handle creating new project from autocomplete
  const handleProjectCreate = useCallback(async (name: string): Promise<Project> => {
    const newProject = await window.api.projects.create({ name, color: '#808080' })
    await refreshProjects()
    // Notify sidebar to refresh projects
    notifyProjectsChanged()
    return newProject
  }, [refreshProjects])

  // Remove a selected label
  const handleRemoveLabel = useCallback((labelId: string) => {
    setLabelIds((prev) => prev.filter((id) => id !== labelId))
    setSelectedLabels((prev) => prev.filter((l) => l.id !== labelId))
  }, [])

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Parse inline modifiers from content
      const parsed = parseInlineTaskContent(content)

      // Resolve project from inline #projectname
      let finalProjectId = projectId
      let finalSectionId = sectionId
      let finalPriority = priority
      let finalDuration = duration
      let finalDeadline: number | undefined

      if (parsed.projectName) {
        const matchedProject = findProjectByName(parsed.projectName, projects)
        if (matchedProject) {
          finalProjectId = matchedProject.id
        }
      }

      // Resolve section from inline /sectionname (within the resolved project)
      if (parsed.sectionName) {
        const matchedSection = findSectionByName(parsed.sectionName, allSections, finalProjectId)
        if (matchedSection) {
          finalSectionId = matchedSection.id
          // If section is in a different project than currently selected, update project
          if (matchedSection.projectId !== finalProjectId) {
            finalProjectId = matchedSection.projectId
          }
        }
      }

      // Resolve labels from inline @labelname
      const finalLabelIds = [...labelIds]
      if (parsed.labelNames) {
        for (const labelName of parsed.labelNames) {
          const matchedLabel = findLabelByName(labelName, labels)
          if (matchedLabel && !finalLabelIds.includes(matchedLabel.id)) {
            finalLabelIds.push(matchedLabel.id)
          }
        }
      }

      // Use inline priority if specified
      if (parsed.priority) {
        finalPriority = parsed.priority
      }

      // Use inline duration if specified
      if (parsed.duration) {
        finalDuration = parsed.duration
      }

      // Parse deadline from inline {date} syntax
      if (parsed.deadlineText) {
        const parsedDeadline = await window.api.parseDate(parsed.deadlineText)
        if (parsedDeadline) {
          finalDeadline = parsedDeadline
        }
      }

      const task = await window.api.tasks.create({
        content: parsed.content.trim() || content.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority: finalPriority,
        projectId: finalProjectId,
        sectionId: finalSectionId || undefined,
        duration: finalDuration || undefined,
        deadline: finalDeadline,
        labelIds: finalLabelIds.length > 0 ? finalLabelIds : undefined
      })

      // Notify parent that task was created
      onTaskCreated?.()

      // Create reminder from inline !datetime syntax
      if (parsed.reminderText && task) {
        const parsedReminder = await window.api.parseDate(parsed.reminderText)
        if (parsedReminder) {
          await window.api.reminders.create({
            taskId: task.id,
            remindAt: parsedReminder
          })
        }
      }

      onOpenChange(false)
    } catch (error) {
      // Task creation failed - silently handle
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  // Handle paste event for multiple tasks
  const handlePaste = async (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    const lines = pastedText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

    // If multiple lines are pasted, create multiple tasks
    if (lines.length > 1) {
      e.preventDefault()
      setIsSubmitting(true)
      try {
        for (const line of lines) {
          // Parse inline modifiers from each line
          const parsed = parseInlineTaskContent(line)

          let finalProjectId = projectId
          let finalSectionId: string | undefined
          let finalPriority = priority
          let finalDuration: number | undefined
          let finalDeadline: number | undefined

          if (parsed.projectName) {
            const matchedProject = findProjectByName(parsed.projectName, projects)
            if (matchedProject) {
              finalProjectId = matchedProject.id
            }
          }

          if (parsed.sectionName) {
            const matchedSection = findSectionByName(parsed.sectionName, allSections, finalProjectId)
            if (matchedSection) {
              finalSectionId = matchedSection.id
              if (matchedSection.projectId !== finalProjectId) {
                finalProjectId = matchedSection.projectId
              }
            }
          }

          // Resolve labels from inline @labelname
          const pastedLabelIds = [...labelIds]
          if (parsed.labelNames) {
            for (const labelName of parsed.labelNames) {
              const matchedLabel = findLabelByName(labelName, labels)
              if (matchedLabel && !pastedLabelIds.includes(matchedLabel.id)) {
                pastedLabelIds.push(matchedLabel.id)
              }
            }
          }

          if (parsed.priority) {
            finalPriority = parsed.priority
          }

          if (parsed.duration) {
            finalDuration = parsed.duration
          }

          // Parse deadline from inline {date} syntax
          if (parsed.deadlineText) {
            const parsedDeadline = await window.api.parseDate(parsed.deadlineText)
            if (parsedDeadline) {
              finalDeadline = parsedDeadline
            }
          }

          const task = await window.api.tasks.create({
            content: parsed.content.trim() || line,
            priority: finalPriority,
            projectId: finalProjectId,
            sectionId: finalSectionId,
            duration: finalDuration,
            deadline: finalDeadline,
            labelIds: pastedLabelIds.length > 0 ? pastedLabelIds : undefined
          })

          // Create reminder from inline !datetime syntax
          if (parsed.reminderText && task) {
            const parsedReminder = await window.api.parseDate(parsed.reminderText)
            if (parsedReminder) {
              await window.api.reminders.create({
                taskId: task.id,
                remindAt: parsedReminder
              })
            }
          }
        }
        // Notify parent that tasks were created
        onTaskCreated?.()
        onOpenChange(false)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-background rounded-lg shadow-xl border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-medium">Quick Add Task</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4" onKeyDown={handleKeyDown}>
          {/* Task content with label and project autocomplete */}
          <TaskContentAutocomplete
            value={content}
            onChange={setContent}
            onLabelSelect={handleLabelSelect}
            onLabelCreate={handleLabelCreate}
            onProjectSelect={handleProjectSelect}
            onProjectCreate={handleProjectCreate}
            onPaste={handlePaste}
            placeholder="Task name (#project @label /section p1-p4 for X min)"
            className="w-full text-lg bg-transparent border-none outline-none placeholder:text-muted-foreground"
            autoFocus
          />

          {/* Selected labels */}
          {selectedLabels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color
                  }}
                >
                  <Tag className="w-3 h-3" />
                  {label.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(label.id)}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Description (optional) */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full h-20 text-sm bg-transparent border rounded-md p-2 outline-none resize-none placeholder:text-muted-foreground"
          />

          {/* Options */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Due date */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-accent cursor-pointer">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Due date"
                className="w-28 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>

            {/* Priority */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-md border">
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <button
                  key={p}
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

            {/* Project */}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-md border text-sm bg-transparent cursor-pointer hover:bg-accent"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Enter</kbd> to save
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-md hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className={cn(
                'px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground',
                (!content.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? 'Adding...' : 'Add task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
