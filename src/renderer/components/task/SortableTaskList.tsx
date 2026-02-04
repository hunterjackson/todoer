import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { TaskItem } from './TaskItem'
import type { Task } from '@shared/types'
import { cn } from '@renderer/lib/utils'

interface SortableTaskListProps {
  tasks: Task[]
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onReorder: (taskId: string, newIndex: number) => void
  showProject?: boolean
}

interface SortableTaskItemProps {
  task: Task
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  showProject?: boolean
}

function SortableTaskItem({
  task,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  showProject
}: SortableTaskItemProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start group',
        isDragging && 'opacity-50 bg-accent rounded-md'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      <div className="flex-1">
        <TaskItem
          task={task}
          onComplete={onComplete}
          onUncomplete={onUncomplete}
          onEdit={onEdit}
          onDelete={onDelete}
          showProject={showProject}
        />
      </div>
    </div>
  )
}

export function SortableTaskList({
  tasks,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  onReorder,
  showProject = false
}: SortableTaskListProps): React.ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id)
      const newIndex = tasks.findIndex((t) => t.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(active.id as string, newIndex)
      }
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No tasks
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onEdit={onEdit}
              onDelete={onDelete}
              showProject={showProject}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
