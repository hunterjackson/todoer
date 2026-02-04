import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the undo/redo stack logic
describe('Undo/Redo Stack', () => {
  let undoStack: UndoRedoStack<TaskOperation>

  beforeEach(() => {
    undoStack = createUndoRedoStack<TaskOperation>()
  })

  describe('Basic Operations', () => {
    it('should start with empty stacks', () => {
      expect(undoStack.canUndo()).toBe(false)
      expect(undoStack.canRedo()).toBe(false)
    })

    it('should push operations to the stack', () => {
      const operation: TaskOperation = {
        type: 'create',
        taskId: '1',
        data: { content: 'Test task' }
      }

      undoStack.push(operation)

      expect(undoStack.canUndo()).toBe(true)
      expect(undoStack.canRedo()).toBe(false)
    })

    it('should undo operations', () => {
      const operation: TaskOperation = {
        type: 'create',
        taskId: '1',
        data: { content: 'Test task' }
      }

      undoStack.push(operation)
      const undone = undoStack.undo()

      expect(undone).toEqual(operation)
      expect(undoStack.canUndo()).toBe(false)
      expect(undoStack.canRedo()).toBe(true)
    })

    it('should redo operations', () => {
      const operation: TaskOperation = {
        type: 'create',
        taskId: '1',
        data: { content: 'Test task' }
      }

      undoStack.push(operation)
      undoStack.undo()
      const redone = undoStack.redo()

      expect(redone).toEqual(operation)
      expect(undoStack.canUndo()).toBe(true)
      expect(undoStack.canRedo()).toBe(false)
    })

    it('should return null when undo on empty stack', () => {
      expect(undoStack.undo()).toBeNull()
    })

    it('should return null when redo on empty stack', () => {
      expect(undoStack.redo()).toBeNull()
    })
  })

  describe('Stack Behavior', () => {
    it('should clear redo stack when pushing new operation', () => {
      undoStack.push({ type: 'create', taskId: '1', data: {} })
      undoStack.undo()

      expect(undoStack.canRedo()).toBe(true)

      undoStack.push({ type: 'create', taskId: '2', data: {} })

      expect(undoStack.canRedo()).toBe(false)
    })

    it('should maintain undo order (LIFO)', () => {
      undoStack.push({ type: 'create', taskId: '1', data: {} })
      undoStack.push({ type: 'update', taskId: '2', data: {} })
      undoStack.push({ type: 'delete', taskId: '3', data: {} })

      const first = undoStack.undo()
      const second = undoStack.undo()
      const third = undoStack.undo()

      expect(!Array.isArray(first) && first?.type).toBe('delete')
      expect(!Array.isArray(second) && second?.type).toBe('update')
      expect(!Array.isArray(third) && third?.type).toBe('create')
    })

    it('should limit stack size', () => {
      const maxSize = 50
      const stack = createUndoRedoStack<TaskOperation>(maxSize)

      // Push more than max size
      for (let i = 0; i < maxSize + 10; i++) {
        stack.push({ type: 'create', taskId: String(i), data: {} })
      }

      // Should only be able to undo maxSize times
      let undoCount = 0
      while (stack.canUndo()) {
        stack.undo()
        undoCount++
      }

      expect(undoCount).toBe(maxSize)
    })
  })

  describe('Operation Types', () => {
    it('should handle create operations', () => {
      const op: TaskOperation = {
        type: 'create',
        taskId: '1',
        data: { content: 'New task', priority: 1 }
      }

      undoStack.push(op)
      const undone = undoStack.undo()

      expect(!Array.isArray(undone) && undone?.type).toBe('create')
      expect(!Array.isArray(undone) && undone?.taskId).toBe('1')
    })

    it('should handle update operations with before/after state', () => {
      const op: TaskOperation = {
        type: 'update',
        taskId: '1',
        data: { content: 'Updated' },
        previousData: { content: 'Original' }
      }

      undoStack.push(op)
      const undone = undoStack.undo()

      expect(!Array.isArray(undone) && undone?.type).toBe('update')
      expect(!Array.isArray(undone) && undone?.previousData?.content).toBe('Original')
    })

    it('should handle delete operations with full task data', () => {
      const op: TaskOperation = {
        type: 'delete',
        taskId: '1',
        data: {
          content: 'Deleted task',
          priority: 2,
          projectId: 'p1'
        }
      }

      undoStack.push(op)
      const undone = undoStack.undo()

      expect(!Array.isArray(undone) && undone?.type).toBe('delete')
      expect(!Array.isArray(undone) && undone?.data.content).toBe('Deleted task')
    })

    it('should handle complete/uncomplete operations', () => {
      const op: TaskOperation = {
        type: 'complete',
        taskId: '1',
        data: {}
      }

      undoStack.push(op)
      const undone = undoStack.undo()

      expect(!Array.isArray(undone) && undone?.type).toBe('complete')
    })
  })

  describe('Clear Operations', () => {
    it('should clear all stacks', () => {
      undoStack.push({ type: 'create', taskId: '1', data: {} })
      undoStack.push({ type: 'create', taskId: '2', data: {} })
      undoStack.undo()

      undoStack.clear()

      expect(undoStack.canUndo()).toBe(false)
      expect(undoStack.canRedo()).toBe(false)
    })
  })

  describe('Batch Operations', () => {
    it('should group multiple operations as one undo', () => {
      undoStack.beginBatch()
      undoStack.push({ type: 'create', taskId: '1', data: {} })
      undoStack.push({ type: 'create', taskId: '2', data: {} })
      undoStack.push({ type: 'create', taskId: '3', data: {} })
      undoStack.endBatch()

      // Should only need one undo to reverse all three
      const batch = undoStack.undo()
      expect(Array.isArray(batch)).toBe(true)
      expect((batch as TaskOperation[]).length).toBe(3)
      expect(undoStack.canUndo()).toBe(false)
    })
  })
})

// Types and implementation for testing
interface TaskOperation {
  type: 'create' | 'update' | 'delete' | 'complete' | 'uncomplete' | 'reorder'
  taskId: string
  data: Record<string, unknown>
  previousData?: Record<string, unknown>
}

interface UndoRedoStack<T> {
  push(operation: T): void
  undo(): T | T[] | null
  redo(): T | T[] | null
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
  beginBatch(): void
  endBatch(): void
}

function createUndoRedoStack<T>(maxSize: number = 100): UndoRedoStack<T> {
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
    }
  }
}
