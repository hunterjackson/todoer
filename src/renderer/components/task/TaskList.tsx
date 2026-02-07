import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useDraggable, useDroppable, DragOverlay, DndContext, DragEndEvent, DragOverEvent, pointerWithin, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, CornerDownRight } from 'lucide-react'
import { TaskItem } from './TaskItem'
import { TaskAddInput } from './TaskAddInput'
import { cn } from '@renderer/lib/utils'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import type { Task, TaskCreate, Priority } from '@shared/types'

interface TaskNode extends Task {
  children: TaskNode[]
  depth: number
}

type DropPosition = 'above' | 'below' | 'child'

interface TaskListProps {
  tasks: Task[]
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onCreate?: (data: TaskCreate) => Promise<void>
  onUpdatePriority?: (id: string, priority: Priority) => void
  onReorder?: (taskId: string, newOrder: number, newParentId?: string | null) => Promise<unknown>
  showProject?: boolean
  emptyMessage?: string
  showAddInput?: boolean
  draggable?: boolean
  allExpanded?: boolean
  onCreateSubtask?: (parentId: string, content: string) => Promise<void>
}

// Build a tree structure from flat tasks list
function buildTaskTree(tasks: Task[]): TaskNode[] {
  const nodeMap = new Map<string, TaskNode>()
  const roots: TaskNode[] = []

  // Create nodes
  for (const task of tasks) {
    nodeMap.set(task.id, { ...task, children: [], depth: 0 })
  }

  // Build tree
  for (const task of tasks) {
    const node = nodeMap.get(task.id)!
    if (task.parentId && nodeMap.has(task.parentId)) {
      const parent = nodeMap.get(task.parentId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by sortOrder
  const sortNodes = (nodes: TaskNode[]): void => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder)
    for (const node of nodes) {
      sortNodes(node.children)
    }
  }
  sortNodes(roots)

  return roots
}

// Flatten tree for rendering, respecting collapsed state
function flattenTaskTree(nodes: TaskNode[], collapsedIds: Set<string>): TaskNode[] {
  const result: TaskNode[] = []
  const traverse = (node: TaskNode): void => {
    result.push(node)
    if (!collapsedIds.has(node.id)) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }
  for (const node of nodes) {
    traverse(node)
  }
  return result
}

interface DraggableTaskWrapperProps {
  task: TaskNode
  children: React.ReactNode
  isDropTarget?: boolean
  dropPosition?: DropPosition | null
}

function DraggableTaskWrapper({
  task,
  children,
  isDropTarget,
  dropPosition
}: DraggableTaskWrapperProps): React.ReactElement {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task
    }
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${task.id}`,
    data: {
      type: 'task-drop',
      task
    }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1
  }

  // Combine refs
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }, [setDragRef, setDropRef])

  return (
    <div
      ref={setRefs}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab active:cursor-grabbing relative',
        isDropTarget && dropPosition === 'child' && 'ring-2 ring-primary ring-offset-1 rounded-md'
      )}
    >
      {/* Drop indicator for above */}
      {isDropTarget && dropPosition === 'above' && (
        <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-primary rounded-full" />
      )}
      {children}
      {/* Drop indicator for below */}
      {isDropTarget && dropPosition === 'below' && (
        <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary rounded-full" />
      )}
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
  onUpdatePriority,
  onReorder,
  showProject = false,
  emptyMessage = 'No tasks',
  showAddInput = true,
  draggable = true,
  allExpanded,
  onCreateSubtask
}: TaskListProps): React.ReactElement {
  const { matchShortcut } = useKeyboardShortcuts()
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set())
  const [inlineSubtaskParentId, setInlineSubtaskParentId] = useState<string | null>(null)
  const [inlineSubtaskContent, setInlineSubtaskContent] = useState('')
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag sensors with distance activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  // Build hierarchical task structure
  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks])
  const flattenedTasks = useMemo(
    () => flattenTaskTree(taskTree, collapsedTasks),
    [taskTree, collapsedTasks]
  )

  // Helper to find a task's index and the task above it
  const findTaskAbove = useCallback((taskId: string): TaskNode | null => {
    const idx = flattenedTasks.findIndex(t => t.id === taskId)
    if (idx <= 0) return null
    return flattenedTasks[idx - 1]
  }, [flattenedTasks])

  // Indent task (make it a child of the task above)
  const indentTask = useCallback(async (taskId: string) => {
    if (!onReorder) return
    const taskAbove = findTaskAbove(taskId)
    if (!taskAbove) return

    // Can only indent if there's a task above at the same or higher level
    const task = flattenedTasks.find(t => t.id === taskId)
    if (!task) return

    // Prevent creating deep nesting (max 3 levels)
    if (taskAbove.depth >= 3) return

    // Make the task a child of the task above it - place at end of its children
    const childMaxOrder = taskAbove.children.length > 0
      ? Math.max(...taskAbove.children.map(c => c.sortOrder))
      : 0
    await onReorder(taskId, childMaxOrder + 1, taskAbove.id)
  }, [flattenedTasks, findTaskAbove, onReorder])

  // Outdent task (move it to parent's level)
  const outdentTask = useCallback(async (taskId: string) => {
    if (!onReorder) return
    const task = flattenedTasks.find(t => t.id === taskId)
    if (!task || !task.parentId) return // Can't outdent a root task

    // Find the parent task
    const parent = flattenedTasks.find(t => t.id === task.parentId)
    if (!parent) return

    // Move to parent's parent (or null if parent is root)
    // Find the next sibling of parent to compute midpoint
    const siblings = flattenedTasks.filter(t => t.parentId === parent.parentId && t.id !== taskId)
    const nextSibling = siblings
      .filter(t => t.sortOrder > parent.sortOrder)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    const newOrder = nextSibling
      ? (parent.sortOrder + nextSibling.sortOrder) / 2
      : parent.sortOrder + 1
    await onReorder(taskId, newOrder, parent.parentId)
  }, [flattenedTasks, onReorder])

  // Handle drag over to determine drop position
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      setDropTargetId(null)
      setDropPosition(null)
      return
    }

    const overData = over.data.current
    if (overData?.type !== 'task-drop') {
      setDropTargetId(null)
      setDropPosition(null)
      return
    }

    const overTask = overData.task as TaskNode
    const overRect = over.rect
    const mouseY = event.activatorEvent instanceof MouseEvent ? event.activatorEvent.clientY : 0

    // Determine position based on where the drag is relative to the target
    const relativeY = mouseY - overRect.top
    const height = overRect.height

    let position: DropPosition
    if (relativeY < height * 0.25) {
      position = 'above'
    } else if (relativeY > height * 0.75) {
      position = 'below'
    } else {
      position = 'child'
    }

    setDropTargetId(overTask.id)
    setDropPosition(position)
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTaskId(null)
    setDropTargetId(null)
    setDropPosition(null)

    if (!over || !onReorder) return

    const activeData = active.data.current
    const overData = over.data.current

    if (activeData?.type !== 'task' || overData?.type !== 'task-drop') return

    const activeTask = activeData.task as TaskNode
    const overTask = overData.task as TaskNode

    if (activeTask.id === overTask.id) return

    // Prevent making a task a child of itself or its descendants
    const isDescendant = (parent: TaskNode, childId: string): boolean => {
      if (parent.id === childId) return true
      return parent.children.some(c => isDescendant(c, childId))
    }

    if (isDescendant(activeTask, overTask.id)) return

    let newParentId: string | null
    let newOrder: number

    if (dropPosition === 'child') {
      // Make active task a child of over task
      newParentId = overTask.id
      newOrder = overTask.children.length > 0
        ? Math.max(...overTask.children.map(c => c.sortOrder)) + 1
        : 1
    } else if (dropPosition === 'above') {
      // Insert above the over task (same parent)
      newParentId = overTask.parentId
      // Find previous sibling to compute midpoint
      const siblings = flattenedTasks.filter(t => t.parentId === overTask.parentId && t.id !== activeTask.id)
      const prevSibling = siblings
        .filter(t => t.sortOrder < overTask.sortOrder)
        .sort((a, b) => b.sortOrder - a.sortOrder)[0]
      newOrder = prevSibling
        ? (prevSibling.sortOrder + overTask.sortOrder) / 2
        : overTask.sortOrder - 1
    } else {
      // Insert below the over task (same parent)
      newParentId = overTask.parentId
      // Find next sibling to compute midpoint
      const siblings = flattenedTasks.filter(t => t.parentId === overTask.parentId && t.id !== activeTask.id)
      const nextSibling = siblings
        .filter(t => t.sortOrder > overTask.sortOrder)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0]
      newOrder = nextSibling
        ? (overTask.sortOrder + nextSibling.sortOrder) / 2
        : overTask.sortOrder + 1
    }

    await onReorder(activeTask.id, newOrder, newParentId)
  }, [onReorder, dropPosition])

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveTaskId(String(event.active.id).replace('task-', ''))
  }, [])

  const toggleTaskCollapse = useCallback((taskId: string) => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }, [])

  // Respond to expand/collapse all
  useEffect(() => {
    if (allExpanded === undefined) return
    if (allExpanded) {
      setCollapsedTasks(new Set())
    } else {
      // Collapse all tasks that have children
      const parentsWithChildren = new Set<string>()
      for (const task of tasks) {
        if (task.parentId) {
          parentsWithChildren.add(task.parentId)
        }
      }
      setCollapsedTasks(parentsWithChildren)
    }
  }, [allExpanded])

  // Reset focus when tasks change
  useEffect(() => {
    if (focusedIndex >= flattenedTasks.length) {
      setFocusedIndex(flattenedTasks.length > 0 ? flattenedTasks.length - 1 : -1)
    }
  }, [flattenedTasks.length, focusedIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle if focused on input
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }

      // Only handle if this list or its children are focused/hovered
      if (!containerRef.current?.contains(document.activeElement) &&
          !containerRef.current?.matches(':hover')) {
        return
      }

      const focusedTask = focusedIndex >= 0 ? flattenedTasks[focusedIndex] : null

      // Move down
      if (matchShortcut(e, 'taskMoveDown')) {
        e.preventDefault()
        setFocusedIndex((prev) => Math.min(prev + 1, flattenedTasks.length - 1))
        return
      }
      // Move up
      if (matchShortcut(e, 'taskMoveUp')) {
        e.preventDefault()
        setFocusedIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      // Complete/uncomplete
      if (matchShortcut(e, 'taskComplete') && focusedTask) {
        e.preventDefault()
        if (focusedTask.completed) {
          onUncomplete(focusedTask.id)
        } else {
          onComplete(focusedTask.id)
        }
        return
      }
      // Edit focused task
      if (matchShortcut(e, 'taskEdit') && focusedTask) {
        e.preventDefault()
        onEdit(focusedTask)
        return
      }
      // Delete focused task
      if (matchShortcut(e, 'taskDelete') && focusedTask) {
        e.preventDefault()
        onDelete(focusedTask.id)
        return
      }
      // Set priority 1-4
      if (focusedTask && onUpdatePriority) {
        if (matchShortcut(e, 'taskPriority1')) {
          e.preventDefault()
          onUpdatePriority(focusedTask.id, 1)
          return
        }
        if (matchShortcut(e, 'taskPriority2')) {
          e.preventDefault()
          onUpdatePriority(focusedTask.id, 2)
          return
        }
        if (matchShortcut(e, 'taskPriority3')) {
          e.preventDefault()
          onUpdatePriority(focusedTask.id, 3)
          return
        }
        if (matchShortcut(e, 'taskPriority4')) {
          e.preventDefault()
          onUpdatePriority(focusedTask.id, 4)
          return
        }
      }
      // Collapse subtasks
      if (matchShortcut(e, 'taskCollapse') && focusedTask && focusedTask.children.length > 0) {
        e.preventDefault()
        if (!collapsedTasks.has(focusedTask.id)) {
          toggleTaskCollapse(focusedTask.id)
        }
        return
      }
      // Also collapse on ArrowLeft (alternate key)
      if (e.key === 'ArrowLeft' && !e.altKey && !e.ctrlKey && !e.metaKey && focusedTask && focusedTask.children.length > 0) {
        e.preventDefault()
        if (!collapsedTasks.has(focusedTask.id)) {
          toggleTaskCollapse(focusedTask.id)
        }
        return
      }
      // Expand subtasks
      if (matchShortcut(e, 'taskExpand') && focusedTask && focusedTask.children.length > 0) {
        e.preventDefault()
        if (collapsedTasks.has(focusedTask.id)) {
          toggleTaskCollapse(focusedTask.id)
        }
        return
      }
      // Also expand on ArrowRight (alternate key)
      if (e.key === 'ArrowRight' && !e.altKey && !e.ctrlKey && !e.metaKey && focusedTask && focusedTask.children.length > 0) {
        e.preventDefault()
        if (collapsedTasks.has(focusedTask.id)) {
          toggleTaskCollapse(focusedTask.id)
        }
        return
      }
      // Outdent (check before indent since Shift+Tab matches before Tab)
      if (matchShortcut(e, 'taskOutdent') && focusedTask && onReorder) {
        e.preventDefault()
        outdentTask(focusedTask.id)
        return
      }
      // Indent
      if (matchShortcut(e, 'taskIndent') && focusedTask && onReorder) {
        e.preventDefault()
        indentTask(focusedTask.id)
        return
      }
      // Add subtask
      if (matchShortcut(e, 'taskAddSubtask') && focusedTask) {
        e.preventDefault()
        setInlineSubtaskParentId(focusedTask.id)
        setInlineSubtaskContent('')
        return
      }
      // Clear focus / close inline subtask
      if (matchShortcut(e, 'taskClearFocus')) {
        if (inlineSubtaskParentId) {
          setInlineSubtaskParentId(null)
          setInlineSubtaskContent('')
        } else {
          setFocusedIndex(-1)
        }
        return
      }
    },
    [focusedIndex, flattenedTasks, collapsedTasks, onComplete, onUncomplete, onEdit, onDelete, onUpdatePriority, toggleTaskCollapse, onReorder, indentTask, outdentTask, inlineSubtaskParentId, matchShortcut]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const activeTask = activeTaskId ? flattenedTasks.find(t => t.id === activeTaskId) : null

  const content = (
    <div ref={containerRef} className="space-y-1" tabIndex={-1}>
      {flattenedTasks.map((task, index) => {
        const isFocused = index === focusedIndex
        const hasChildren = task.children.length > 0
        const isCollapsed = collapsedTasks.has(task.id)
        const isDropTarget = dropTargetId === task.id
        const taskItem = (
          <div
            className={cn(
              'rounded-md transition-colors flex items-start',
              isFocused && 'ring-2 ring-primary ring-offset-1'
            )}
            style={{ paddingLeft: `${task.depth * 24}px` }}
            onClick={() => setFocusedIndex(index)}
          >
            {/* Collapse/expand toggle for parent tasks */}
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleTaskCollapse(task.id)
                }}
                className="p-1 mt-1.5 rounded hover:bg-accent flex-shrink-0"
                title={isCollapsed ? 'Expand subtasks' : 'Collapse subtasks'}
              >
                <ChevronRight
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    !isCollapsed && 'rotate-90'
                  )}
                />
              </button>
            ) : task.depth > 0 ? (
              <span className="w-6 flex-shrink-0" /> // Spacer for alignment with siblings
            ) : null}
            <div className="flex-1 min-w-0">
              <TaskItem
                key={task.id}
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

        const subtaskInput = inlineSubtaskParentId === task.id && (
          <div
            className="flex gap-2 mt-1"
            style={{ paddingLeft: `${(task.depth + 1) * 24 + 24}px` }}
          >
            <input
              type="text"
              value={inlineSubtaskContent}
              onChange={(e) => setInlineSubtaskContent(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && inlineSubtaskContent.trim()) {
                  e.preventDefault()
                  e.stopPropagation()
                  if (onCreateSubtask) {
                    await onCreateSubtask(task.id, inlineSubtaskContent.trim())
                  } else if (onCreate) {
                    await onCreate({ content: inlineSubtaskContent.trim(), parentId: task.id })
                  } else {
                    await window.api.tasks.create({
                      content: inlineSubtaskContent.trim(),
                      parentId: task.id,
                      projectId: task.projectId
                    })
                  }
                  setInlineSubtaskContent('')
                  setInlineSubtaskParentId(null)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setInlineSubtaskParentId(null)
                  setInlineSubtaskContent('')
                }
              }}
              placeholder="Subtask name (Enter to add, Esc to cancel)"
              className="flex-1 px-3 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
        )

        return draggable && onReorder ? (
          <React.Fragment key={task.id}>
            <DraggableTaskWrapper
              task={task}
              isDropTarget={isDropTarget}
              dropPosition={isDropTarget ? dropPosition : null}
            >
              {taskItem}
            </DraggableTaskWrapper>
            {subtaskInput}
          </React.Fragment>
        ) : (
          <React.Fragment key={task.id}>
            <div>{taskItem}</div>
            {subtaskInput}
          </React.Fragment>
        )
      })}

      {flattenedTasks.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          {emptyMessage}
        </div>
      )}

      {showAddInput && onCreate && (
        <TaskAddInput onCreate={onCreate} />
      )}
    </div>
  )

  // Wrap in DndContext if reordering is enabled
  if (draggable && onReorder) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {content}
        <DragOverlay>
          {activeTask ? (
            <div className="bg-background border rounded-md shadow-lg px-3 py-2 text-sm flex items-center gap-2">
              <CornerDownRight className="w-4 h-4 text-muted-foreground" />
              {activeTask.content}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    )
  }

  return content
}
