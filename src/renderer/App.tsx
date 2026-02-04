import React, { useEffect, useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { Sidebar } from './components/sidebar/Sidebar'
import { TodayView } from './components/views/TodayView'
import { InboxView } from './components/views/InboxView'
import { ProjectView } from './components/views/ProjectView'
import { UpcomingView } from './components/views/UpcomingView'
import { SearchView } from './components/views/SearchView'
import { LabelView } from './components/views/LabelView'
import { CalendarView } from './components/views/CalendarView'
import { FilterView } from './components/views/FilterView'
import { QuickAddModal } from './components/task/QuickAddModal'
import { KeyboardShortcutsHelp } from './components/ui/KeyboardShortcutsHelp'
import { ExportImportToast } from './components/ui/ExportImportToast'
import { useStore } from './stores/useStore'
import type { Task, ViewType } from '@shared/types'

export default function App(): React.ReactElement {
  const { currentView, currentViewId, setView, searchQuery, theme, sidebarCollapsed, toggleSidebar } = useStore()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Handle drag end - move task to new project
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // Check if dragging a task onto a project
    if (activeData?.type === 'task' && overData?.type === 'project') {
      const task = activeData.task as Task
      const newProjectId = overData.projectId as string

      // Don't do anything if dropping on same project
      if (task.projectId === newProjectId) return

      try {
        await window.api.tasks.update(task.id, { projectId: newProjectId })
        // Trigger refresh of views
        setRefreshKey((k) => k + 1)
      } catch (err) {
        console.error('Failed to move task:', err)
      }
    }
  }, [])

  const handleDragStart = useCallback((event: { active: { data: { current?: { task?: Task } } } }) => {
    if (event.active.data.current?.task) {
      setActiveTask(event.active.data.current.task)
    }
  }, [])

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  // Handle menu export/import events
  useEffect(() => {
    const handleExportJSON = async () => {
      const result = await window.api.data.exportJSON()
      if (result.success) {
        setToast({ message: `Data exported to ${result.path}`, type: 'success' })
      } else if (!result.canceled) {
        setToast({ message: 'Export failed', type: 'error' })
      }
    }

    const handleExportCSV = async () => {
      const result = await window.api.data.exportCSV()
      if (result.success) {
        setToast({ message: `Tasks exported to ${result.path}`, type: 'success' })
      } else if (!result.canceled) {
        setToast({ message: 'Export failed', type: 'error' })
      }
    }

    const handleImportJSON = async () => {
      const result = await window.api.data.importJSON()
      if (result.success && result.imported) {
        const { tasks, projects, labels, filters } = result.imported
        setToast({
          message: `Imported ${tasks} tasks, ${projects} projects, ${labels} labels, ${filters} filters`,
          type: 'success'
        })
        setRefreshKey((k) => k + 1)
      } else if (!result.canceled) {
        setToast({ message: result.error || 'Import failed', type: 'error' })
      }
    }

    const handleImportCSV = async () => {
      const result = await window.api.data.importCSV()
      if (result.success && result.imported) {
        setToast({ message: `Imported ${result.imported.tasks} tasks`, type: 'success' })
        setRefreshKey((k) => k + 1)
      } else if (!result.canceled) {
        setToast({ message: result.error || 'Import failed', type: 'error' })
      }
    }

    const unsubExportJSON = window.api.on('menu:exportJSON', handleExportJSON)
    const unsubExportCSV = window.api.on('menu:exportCSV', handleExportCSV)
    const unsubImportJSON = window.api.on('menu:importJSON', handleImportJSON)
    const unsubImportCSV = window.api.on('menu:importCSV', handleImportCSV)

    return () => {
      unsubExportJSON()
      unsubExportCSV()
      unsubImportJSON()
      unsubImportCSV()
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isInput = isInputFocused()

      // Undo: Cmd/Ctrl+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        const result = await window.api.undo.undo()
        if (result.success) {
          setToast({ message: `Undid ${result.operation}`, type: 'success' })
          setRefreshKey((k) => k + 1)
        }
        return
      }

      // Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
      if (
        (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
        (e.key === 'y' && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault()
        const result = await window.api.undo.redo()
        if (result.success) {
          setToast({ message: `Redid ${result.operation}`, type: 'success' })
          setRefreshKey((k) => k + 1)
        }
        return
      }

      // Quick add: q
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !isInput) {
        e.preventDefault()
        setQuickAddOpen(true)
      }

      // Search: /
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        setView('search')
      }

      // Toggle sidebar: m
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && !isInput) {
        e.preventDefault()
        toggleSidebar()
      }

      // Show keyboard shortcuts help: ?
      if (e.key === '?' && !isInput) {
        e.preventDefault()
        setShowShortcutsHelp(true)
      }

      // Go to Calendar: g c
      if (e.key === 'c' && window.__lastKey === 'g' && !isInput) {
        e.preventDefault()
        setView('calendar')
      }

      // Go to Today: g t
      if (e.key === 't' && window.__lastKey === 'g' && !isInput) {
        e.preventDefault()
        setView('today')
      }

      // Go to Inbox: g i
      if (e.key === 'i' && window.__lastKey === 'g' && !isInput) {
        e.preventDefault()
        setView('inbox')
      }

      // Go to Upcoming: g u
      if (e.key === 'u' && window.__lastKey === 'g' && !isInput) {
        e.preventDefault()
        setView('upcoming')
      }

      window.__lastKey = e.key
      setTimeout(() => {
        window.__lastKey = ''
      }, 500)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setView, toggleSidebar])

  const renderView = () => {
    switch (currentView) {
      case 'today':
        return <TodayView />
      case 'inbox':
        return <InboxView />
      case 'upcoming':
        return <UpcomingView />
      case 'calendar':
        return <CalendarView />
      case 'project':
        return <ProjectView projectId={currentViewId!} />
      case 'label':
        return <LabelView labelId={currentViewId!} />
      case 'filter':
        return <FilterView filterId={currentViewId!} />
      case 'search':
        return <SearchView initialQuery={searchQuery} />
      default:
        return <TodayView />
    }
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-background">
        {!sidebarCollapsed && (
          <Sidebar
            currentView={currentView}
            onViewChange={setView}
            onQuickAdd={() => setQuickAddOpen(true)}
          />
        )}
        <main className="flex-1 overflow-auto" key={refreshKey}>
          {renderView()}
        </main>
        <QuickAddModal
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
        />
        <KeyboardShortcutsHelp
          open={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
        />
        {toast && (
          <ExportImportToast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="bg-background border rounded-md shadow-lg px-3 py-2 text-sm">
            {activeTask.content}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Helper to check if input is focused
function isInputFocused(): boolean {
  const active = document.activeElement
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active?.getAttribute('contenteditable') === 'true'
  )
}

// Global type for last key tracking
declare global {
  interface Window {
    __lastKey: string
  }
}

window.__lastKey = ''
