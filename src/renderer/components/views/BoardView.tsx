import React, { useState, useCallback } from 'react'
import { DndContext, DragEndEvent, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, MoreHorizontal, GripVertical } from 'lucide-react'
import { useTasks } from '@hooks/useTasks'
import { useSections } from '@hooks/useSections'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { cn } from '@renderer/lib/utils'
import type { Task, Section } from '@shared/types'

interface BoardViewProps {
  projectId: string
}

interface BoardColumnProps {
  section: Section | null
  tasks: Task[]
  onComplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onCreate: (sectionId: string | null) => void
  onEditSection?: () => void
  onDeleteSection?: () => void
}

function BoardColumn({
  section,
  tasks,
  onComplete,
  onEdit,
  onDelete,
  onCreate,
  onEditSection,
  onDeleteSection
}: BoardColumnProps): React.ReactElement {
  const [showMenu, setShowMenu] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: section?.id || 'no-section',
    data: { type: 'column', section }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-col w-72 min-w-72 bg-muted/30 rounded-lg',
        isDragging && 'ring-2 ring-primary'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          {section && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab hover:bg-accent rounded p-1"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <h3 className="font-medium text-sm">
            {section?.name || 'No Section'}
          </h3>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {tasks.length}
          </span>
        </div>
        {section && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-accent"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-popover border rounded-md shadow-lg z-10">
                <button
                  onClick={() => {
                    onEditSection?.()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDeleteSection?.()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-destructive"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <BoardTask
              key={task.id}
              task={task}
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {/* Add Task Button */}
        <button
          onClick={() => onCreate(section?.id || null)}
          className="w-full flex items-center gap-2 p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded"
        >
          <Plus className="w-4 h-4" />
          Add task
        </button>
      </div>
    </div>
  )
}

interface BoardTaskProps {
  task: Task
  onComplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}

function BoardTask({ task, onComplete, onEdit, onDelete }: BoardTaskProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: { type: 'task', task }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const priorityColors: Record<number, string> = {
    1: 'border-l-red-500',
    2: 'border-l-orange-500',
    3: 'border-l-blue-500',
    4: 'border-l-transparent'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-background p-3 rounded-md border border-l-4 cursor-grab hover:shadow-sm',
        priorityColors[task.priority] || 'border-l-transparent',
        isDragging && 'ring-2 ring-primary shadow-lg'
      )}
      onClick={(e) => {
        if (!isDragging) {
          onEdit(task)
        }
      }}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={(e) => {
            e.stopPropagation()
            onComplete(task.id)
          }}
          className="mt-1 rounded"
        />
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm',
            task.completed && 'line-through text-muted-foreground'
          )}>
            {task.content}
          </p>
          {task.dueDate && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(task.dueDate).toLocaleDateString()}
            </p>
          )}
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.labels.map((label) => (
                <span
                  key={label.id}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: label.color + '20', color: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function BoardView({ projectId }: BoardViewProps): React.ReactElement {
  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    completeTask,
    deleteTask
  } = useTasks({ projectId, completed: false })
  const {
    sections,
    loading: sectionsLoading,
    createSection,
    updateSection,
    deleteSection
  } = useSections(projectId)

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newSectionName, setNewSectionName] = useState('')
  const [showNewSectionInput, setShowNewSectionInput] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [editSectionName, setEditSectionName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  const loading = tasksLoading || sectionsLoading

  // Group tasks by section
  const tasksBySection = useCallback(() => {
    const grouped: Record<string, Task[]> = { 'no-section': [] }

    sections.forEach((section) => {
      grouped[section.id] = []
    })

    tasks.forEach((task) => {
      const key = task.sectionId || 'no-section'
      if (grouped[key]) {
        grouped[key].push(task)
      } else {
        grouped['no-section'].push(task)
      }
    })

    return grouped
  }, [tasks, sections])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // Handle task drag
    if (activeData?.type === 'task' && overData) {
      const task = activeData.task as Task
      let newSectionId: string | null = null

      if (overData.type === 'task') {
        // Dropped on another task - get that task's section
        const overTask = overData.task as Task
        newSectionId = overTask.sectionId
      } else if (overData.type === 'column') {
        // Dropped on column
        newSectionId = overData.section?.id || null
      }

      // Only update if section changed
      if (task.sectionId !== newSectionId) {
        await updateTask(task.id, { sectionId: newSectionId })
      }
    }
  }

  const handleCreateTask = async (sectionId: string | null) => {
    await createTask({
      content: 'New task',
      projectId,
      sectionId
    })
  }

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return

    await createSection({
      name: newSectionName.trim(),
      projectId
    })
    setNewSectionName('')
    setShowNewSectionInput(false)
  }

  const handleUpdateSection = async () => {
    if (!editingSection || !editSectionName.trim()) return

    await updateSection(editingSection.id, { name: editSectionName.trim() })
    setEditingSection(null)
    setEditSectionName('')
  }

  const grouped = tasksBySection()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto p-4">
            <div className="flex gap-4 h-full">
              {/* No Section Column */}
              <BoardColumn
                section={null}
                tasks={grouped['no-section']}
                onComplete={completeTask}
                onEdit={setEditingTask}
                onDelete={deleteTask}
                onCreate={handleCreateTask}
              />

              {/* Section Columns */}
              {sections.map((section) => (
                <BoardColumn
                  key={section.id}
                  section={section}
                  tasks={grouped[section.id] || []}
                  onComplete={completeTask}
                  onEdit={setEditingTask}
                  onDelete={deleteTask}
                  onCreate={handleCreateTask}
                  onEditSection={() => {
                    setEditingSection(section)
                    setEditSectionName(section.name)
                  }}
                  onDeleteSection={() => deleteSection(section.id)}
                />
              ))}

              {/* Add Section Column */}
              <div className="w-72 min-w-72">
                {showNewSectionInput ? (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateSection()
                        if (e.key === 'Escape') {
                          setShowNewSectionInput(false)
                          setNewSectionName('')
                        }
                      }}
                      placeholder="Section name"
                      className="w-full px-2 py-1 text-sm border rounded"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleCreateSection}
                        className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowNewSectionInput(false)
                          setNewSectionName('')
                        }}
                        className="px-3 py-1 text-sm hover:bg-accent rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewSectionInput(true)}
                    className="w-full flex items-center gap-2 p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    Add section
                  </button>
                )}
              </div>
            </div>
          </div>
        </DndContext>
      }

      {/* Edit Task Dialog */}
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={async (id, data) => {
          await updateTask(id, data)
        }}
        onDelete={async (id) => { await deleteTask(id) }}
      />

      {/* Edit Section Dialog */}
      {editingSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-4 rounded-lg w-80">
            <h3 className="font-medium mb-3">Edit Section</h3>
            <input
              type="text"
              value={editSectionName}
              onChange={(e) => setEditSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateSection()
                if (e.key === 'Escape') setEditingSection(null)
              }}
              className="w-full px-3 py-2 border rounded"
              autoFocus
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setEditingSection(null)}
                className="px-3 py-1.5 text-sm hover:bg-accent rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSection}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
