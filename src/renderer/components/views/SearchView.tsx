import React, { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { TaskList } from '../task/TaskList'
import { TaskEditDialog } from '../task/TaskEditDialog'
import { useTaskSearch, useTasks } from '@hooks/useTasks'
import type { Task, Priority } from '@shared/types'

interface SearchViewProps {
  initialQuery?: string
}

export function SearchView({ initialQuery = '' }: SearchViewProps): React.ReactElement {
  const [query, setQuery] = useState(initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const { tasks, loading } = useTaskSearch(query)
  const { completeTask, uncompleteTask, updateTask, deleteTask, createTask } = useTasks()
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
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

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks..."
          className="w-full pl-10 pr-10 py-3 text-lg bg-muted/50 border rounded-lg outline-none focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results */}
      {!query ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>Enter a search query to find tasks</p>
          <p className="text-sm mt-2">
            Search by task name or description
          </p>
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-muted-foreground">
          Searching...
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>No tasks found for &quot;{query}&quot;</p>
          <p className="text-sm mt-2">
            Try different keywords
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Found {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
          <TaskList
            tasks={tasks}
            onComplete={completeTask}
            onUncomplete={uncompleteTask}
            onEdit={setEditingTask}
            onDelete={deleteTask}
            onUpdatePriority={handleUpdatePriority}
            onCreate={async (data) => { await createTask(data) }}
            showProject
            showAddInput={false}
          />
        </div>
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
