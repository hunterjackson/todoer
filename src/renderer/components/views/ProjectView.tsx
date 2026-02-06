import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { MoreHorizontal, List, LayoutGrid, Edit2, Trash2, Plus, Archive } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { TaskSortOptions, sortTasks, groupTasks } from '../ui/TaskSortOptions'
import { CompletedTasksSection } from '../task/CompletedTasksSection'
import { ProjectComments } from '../project/ProjectComments'
import { ProjectDialog } from '../project/ProjectDialog'
import { BoardView } from './BoardView'
import { useStore } from '@renderer/stores/useStore'
import { useTasks } from '@hooks/useTasks'
import { useProject, useProjects } from '@hooks/useProjects'
import { useConfirmDelete, useSettings } from '@hooks/useSettings'
import { cn } from '@renderer/lib/utils'
import type { Task, Priority } from '@shared/types'

interface ProjectViewProps {
  projectId: string
}

export function ProjectView({ projectId }: ProjectViewProps): React.ReactElement {
  const { project, loading: projectLoading, refresh: refreshProject } = useProject(projectId)
  const { updateProject, deleteProject } = useProjects()
  const { projects } = useProjects()
  const { tasks, loading: tasksLoading, createTask, updateTask, completeTask, uncompleteTask, deleteTask, reorderTask } = useTasks({
    projectId,
    completed: false
  })
  const confirmDelete = useConfirmDelete()
  const { settings } = useSettings()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [allExpanded, setAllExpanded] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const setView = useStore((s) => s.setView)

  const viewKey = `project-${projectId}`
  const viewSettings = useStore((s) => s.getViewSettings(viewKey))
  const setViewSettings = useStore((s) => s.setViewSettings)

  const { sortField, sortDirection, groupBy, showCompleted } = viewSettings

  const loading = projectLoading || tasksLoading
  const viewMode = project?.viewMode || 'list'

  const sortedTasks = useMemo(() => {
    return sortTasks(tasks, sortField, sortDirection)
  }, [tasks, sortField, sortDirection])

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return null
    return groupTasks(sortedTasks, groupBy, projects, settings.dateFormat)
  }, [sortedTasks, groupBy, projects, settings.dateFormat])

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSaveTask = async (id: string, data: Parameters<typeof updateTask>[1]) => {
    await updateTask(id, data)
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
  }

  const handleUpdatePriority = async (id: string, priority: Priority) => {
    await updateTask(id, { priority })
  }

  const setViewMode = async (mode: 'list' | 'board') => {
    if (!project || viewMode === mode) return
    await updateProject(project.id, { viewMode: mode })
    // Refresh the project to get the updated viewMode
    await refreshProject()
  }

  const handleDeleteProject = async () => {
    if (!project) return
    if (await confirmDelete(`Are you sure you want to delete "${project.name}"?`)) {
      await deleteProject(project.id)
      setView('inbox')
    }
  }

  const handleArchiveProject = async () => {
    if (!project) return
    await updateProject(project.id, { archivedAt: Date.now() })
    setView('inbox')
  }

  const handleAddSection = async () => {
    if (!project) return
    const name = prompt('Section name:')
    if (name?.trim()) {
      await window.api.sections.create({ name: name.trim(), projectId: project.id })
      await refreshProject()
    }
    setMenuOpen(false)
  }

  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev)
  }, [])

  if (!project && !loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="py-8 text-center text-muted-foreground">
          Project not found
        </div>
      </div>
    )
  }

  const menuButton = (
    <div className="relative" ref={menuRef}>
      <button
        className="p-2 rounded-md hover:bg-accent"
        onClick={() => setMenuOpen(!menuOpen)}
        title="Project options"
      >
        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-50 mt-1 w-48 bg-popover border rounded-md shadow-lg">
          <div className="py-1">
            <button
              onClick={handleAddSection}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <Plus className="w-4 h-4" />
              Add section
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                setEditProjectOpen(true)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <Edit2 className="w-4 h-4" />
              Edit project
            </button>
            <div className="border-t my-1" />
            <button
              onClick={() => {
                setMenuOpen(false)
                handleArchiveProject()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <Archive className="w-4 h-4" />
              Archive project
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                handleDeleteProject()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Delete project
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const viewToggle = (
    <div className="flex items-center border rounded-md">
      <button
        onClick={() => setViewMode('list')}
        className={cn('p-2 rounded-l-md', viewMode === 'list' && 'bg-accent')}
        title="List view"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => setViewMode('board')}
        className={cn('p-2 rounded-r-md', viewMode === 'board' && 'bg-accent')}
        title="Board view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  )

  // Board view takes full height
  if (viewMode === 'board') {
    return (
      <div className="h-full flex flex-col">
        {/* Header with view toggle */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: project?.color || '#808080' }}
            />
            <div>
              <h1 className="text-xl font-bold">{project?.name || 'Loading...'}</h1>
              {project?.description && (
                <p className="text-sm text-muted-foreground">{project.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewToggle}
            {menuButton}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <BoardView projectId={projectId} />
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: project?.color || '#808080' }}
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{project?.name || 'Loading...'}</h1>
              {project?.description && (
                <p className="text-sm text-muted-foreground truncate">{project.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {viewToggle}
            {menuButton}
          </div>
        </div>
        <div className="flex items-center justify-end mt-2">
          <TaskSortOptions
            sortField={sortField}
            sortDirection={sortDirection}
            groupBy={groupBy}
            onSortChange={(field, direction) => setViewSettings(viewKey, { sortField: field, sortDirection: direction })}
            onGroupChange={(g) => setViewSettings(viewKey, { groupBy: g })}
            showCompleted={showCompleted}
            onToggleCompleted={(show) => setViewSettings(viewKey, { showCompleted: show })}
            allExpanded={allExpanded}
            onToggleExpandAll={handleToggleExpandAll}
            excludeGroupOptions={['project']}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <>
          {groupedTasks ? (
            groupedTasks.map((group) => (
              <div key={group.key} className="mb-4">
                {group.label && (
                  <div className="flex items-center gap-2 mb-2">
                    {group.color && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                    )}
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {group.label} ({group.tasks.length})
                    </h3>
                  </div>
                )}
                <TaskList
                  tasks={group.tasks}
                  onComplete={completeTask}
                  onUncomplete={uncompleteTask}
                  onEdit={setEditingTask}
                  onDelete={deleteTask}
                  onUpdatePriority={handleUpdatePriority}
                  onReorder={reorderTask}
                  showAddInput={false}
                  allExpanded={allExpanded}
                />
              </div>
            ))
          ) : (
            <TaskList
              tasks={sortedTasks}
              onComplete={completeTask}
              onUncomplete={uncompleteTask}
              onEdit={setEditingTask}
              onDelete={deleteTask}
              onUpdatePriority={handleUpdatePriority}
              onReorder={reorderTask}
              onCreate={async (data) => {
                await createTask({
                  ...data,
                  projectId
                })
              }}
              emptyMessage="No tasks in this project yet"
              allExpanded={allExpanded}
            />
          )}

          {showCompleted && (
            <CompletedTasksSection
              projectId={projectId}
              onUncomplete={uncompleteTask}
              onEdit={setEditingTask}
              onDelete={deleteTask}
              autoExpand
            />
          )}

          {/* Project Notes */}
          <ProjectComments projectId={projectId} />
        </>
      )}

      {/* Edit Dialog */}
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onEditTask={setEditingTask}
      />

      <ProjectDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        project={project}
        projects={projects}
        onSave={async (data) => {
          if (project) {
            await updateProject(project.id, data)
            refreshProject()
          }
        }}
      />
    </div>
  )
}
