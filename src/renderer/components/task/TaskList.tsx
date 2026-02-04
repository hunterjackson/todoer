import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem'
import { TaskAddInput } from './TaskAddInput'
import type { Task, TaskCreate } from '@shared/types'

interface TaskListProps {
  tasks: Task[]
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onCreate?: (data: TaskCreate) => Promise<void>
  showProject?: boolean
  emptyMessage?: string
  showAddInput?: boolean
  draggable?: boolean
}

function DraggableTaskWrapper({
  task,
  children
}: {
  task: Task
  children: React.ReactNode
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task
    }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  )
}

export function TaskList({
  tasks,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  onCreate,
  showProject = false,
  emptyMessage = 'No tasks',
  showAddInput = true,
  draggable = true
}: TaskListProps): React.ReactElement {
  return (
    <div className="space-y-1">
      {tasks.map((task) => {
        const taskItem = (
          <TaskItem
            key={task.id}
            task={task}
            onComplete={onComplete}
            onUncomplete={onUncomplete}
            onEdit={onEdit}
            onDelete={onDelete}
            showProject={showProject}
          />
        )

        return draggable ? (
          <DraggableTaskWrapper key={task.id} task={task}>
            {taskItem}
          </DraggableTaskWrapper>
        ) : (
          taskItem
        )
      })}

      {tasks.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          {emptyMessage}
        </div>
      )}

      {showAddInput && onCreate && (
        <TaskAddInput onCreate={onCreate} />
      )}
    </div>
  )
}
