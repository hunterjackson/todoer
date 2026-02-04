import React, { useState } from 'react'
import { MoreHorizontal, List, LayoutGrid } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { CompletedTasksSection } from '../task/CompletedTasksSection'
import { BoardView } from './BoardView'
import { useTasks } from '@hooks/useTasks'
import { useProject, useProjects } from '@hooks/useProjects'
import { cn } from '@renderer/lib/utils'
import type { Task } from '@shared/types'

interface ProjectViewProps {
  projectId: string
}

export function ProjectView({ projectId }: ProjectViewProps): React.ReactElement {
  const { project, loading: projectLoading } = useProject(projectId)
  const { updateProject } = useProjects()
  const { tasks, loading: tasksLoading, createTask, updateTask, completeTask, uncompleteTask, deleteTask } = useTasks({
    projectId,
    completed: false
  })
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const loading = projectLoading || tasksLoading
  const viewMode = project?.viewMode || 'list'

  const handleSaveTask = async (id: string, data: Parameters<typeof updateTask>[1]) => {
    await updateTask(id, data)
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
  }

  const toggleViewMode = async () => {
    if (!project) return
    const newMode = viewMode === 'list' ? 'board' : 'list'
    await updateProject(project.id, { viewMode: newMode })
  }

  if (!project && !loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="py-8 text-center text-muted-foreground">
          Project not found
        </div>
      </div>
    )
  }

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
              <p className="text-sm text-muted-foreground">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <button
                onClick={toggleViewMode}
                className={cn(
                  'p-2 rounded-l-md',
                  viewMode === 'list' && 'bg-accent'
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={toggleViewMode}
                className={cn(
                  'p-2 rounded-r-md',
                  viewMode === 'board' && 'bg-accent'
                )}
                title="Board view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button className="p-2 rounded-md hover:bg-accent">
              <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <BoardView projectId={projectId} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: project?.color || '#808080' }}
          />
          <div>
            <h1 className="text-2xl font-bold">{project?.name || 'Loading...'}</h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <button
              onClick={toggleViewMode}
              className={cn(
                'p-2 rounded-l-md',
                viewMode === 'list' && 'bg-accent'
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={toggleViewMode}
              className={cn(
                'p-2 rounded-r-md',
                viewMode === 'board' && 'bg-accent'
              )}
              title="Board view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button className="p-2 rounded-md hover:bg-accent">
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <>
          <TaskList
            tasks={tasks}
            onComplete={completeTask}
            onUncomplete={uncompleteTask}
            onEdit={setEditingTask}
            onDelete={deleteTask}
            onCreate={async (data) => {
              await createTask({
                ...data,
                projectId
              })
            }}
            emptyMessage="No tasks in this project yet"
          />

          <CompletedTasksSection
            projectId={projectId}
            onUncomplete={uncompleteTask}
            onEdit={setEditingTask}
            onDelete={deleteTask}
          />
        </>
      )}

      {/* Edit Dialog */}
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}
