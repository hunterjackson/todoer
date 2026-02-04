import type { Task, TaskCreate, TaskUpdate } from '@shared/types'

export type OperationType = 'create' | 'update' | 'delete' | 'complete' | 'uncomplete' | 'reorder'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TaskOperation {
  type: OperationType
  taskId: string
  data: any
  previousData?: any
  timestamp: number
}

export interface UndoRedoStack<T> {
  push(operation: T): void
  undo(): T | T[] | null
  redo(): T | T[] | null
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
  beginBatch(): void
  endBatch(): void
  getUndoStack(): (T | T[])[]
  getRedoStack(): (T | T[])[]
}

export function createUndoRedoStack<T>(maxSize: number = 100): UndoRedoStack<T> {
  const undoStack: (T | T[])[] = []
  const redoStack: (T | T[])[] = []
  let batchMode = false
  let currentBatch: T[] = []

  return {
    push(operation: T) {
      if (batchMode) {
        currentBatch.push(operation)
        return
      }

      undoStack.push(operation)
      redoStack.length = 0 // Clear redo on new operation

      // Enforce max size
      while (undoStack.length > maxSize) {
        undoStack.shift()
      }
    },

    undo(): T | T[] | null {
      if (undoStack.length === 0) return null
      const operation = undoStack.pop()!
      redoStack.push(operation)
      return operation
    },

    redo(): T | T[] | null {
      if (redoStack.length === 0) return null
      const operation = redoStack.pop()!
      undoStack.push(operation)
      return operation
    },

    canUndo() {
      return undoStack.length > 0
    },

    canRedo() {
      return redoStack.length > 0
    },

    clear() {
      undoStack.length = 0
      redoStack.length = 0
      currentBatch = []
      batchMode = false
    },

    beginBatch() {
      batchMode = true
      currentBatch = []
    },

    endBatch() {
      batchMode = false
      if (currentBatch.length > 0) {
        undoStack.push([...currentBatch])
        redoStack.length = 0
      }
      currentBatch = []
    },

    getUndoStack() {
      return [...undoStack]
    },

    getRedoStack() {
      return [...redoStack]
    }
  }
}

// Create a singleton instance for task operations
export const taskUndoStack = createUndoRedoStack<TaskOperation>(50)

/**
 * Execute undo for a task operation
 * Returns the inverse operation that was performed
 */
export function getUndoAction(operation: TaskOperation): {
  action: 'create' | 'update' | 'delete' | 'complete' | 'uncomplete'
  taskId: string
  data?: Partial<Task>
} {
  switch (operation.type) {
    case 'create':
      // Undo create = delete
      return { action: 'delete', taskId: operation.taskId }

    case 'delete':
      // Undo delete = recreate with original data
      return {
        action: 'create',
        taskId: operation.taskId,
        data: operation.data as Partial<Task>
      }

    case 'update':
      // Undo update = restore previous data
      return {
        action: 'update',
        taskId: operation.taskId,
        data: operation.previousData
      }

    case 'complete':
      // Undo complete = uncomplete
      return { action: 'uncomplete', taskId: operation.taskId }

    case 'uncomplete':
      // Undo uncomplete = complete
      return { action: 'complete', taskId: operation.taskId }

    case 'reorder':
      // Undo reorder = restore previous order
      return {
        action: 'update',
        taskId: operation.taskId,
        data: operation.previousData
      }

    default:
      throw new Error(`Unknown operation type: ${operation.type}`)
  }
}

/**
 * Execute redo for a task operation
 * Returns the original operation that needs to be performed
 */
export function getRedoAction(operation: TaskOperation): {
  action: 'create' | 'update' | 'delete' | 'complete' | 'uncomplete'
  taskId: string
  data?: Partial<Task>
} {
  switch (operation.type) {
    case 'create':
      return {
        action: 'create',
        taskId: operation.taskId,
        data: operation.data as Partial<Task>
      }

    case 'delete':
      return { action: 'delete', taskId: operation.taskId }

    case 'update':
      return {
        action: 'update',
        taskId: operation.taskId,
        data: operation.data as Partial<Task>
      }

    case 'complete':
      return { action: 'complete', taskId: operation.taskId }

    case 'uncomplete':
      return { action: 'uncomplete', taskId: operation.taskId }

    case 'reorder':
      return {
        action: 'update',
        taskId: operation.taskId,
        data: operation.data as Partial<Task>
      }

    default:
      throw new Error(`Unknown operation type: ${operation.type}`)
  }
}
