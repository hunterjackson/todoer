import React, { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
import { SettingsPanel } from './components/settings/SettingsPanel'
import { ProductivityPanel } from './components/settings/ProductivityPanel'
import { useStore } from './stores/useStore'
import type { Task } from '@shared/types'

export default function App(): React.ReactElement {
  const { currentView, currentViewId, setView, searchQuery, theme, sidebarCollapsed, toggleSidebar, goBack, goForward, canGoBack, canGoForward } = useStore()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProductivity, setShowProductivity] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Configure drag sensors with activation constraint
  // This requires 8px of movement before drag activates, allowing clicks to work normally
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

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
        // Clear sectionId when moving to a different project, since sections belong to projects
        await window.api.tasks.update(task.id, { projectId: newProjectId, sectionId: null })
        // Trigger refresh of views
        setRefreshKey((k) => k + 1)
      } catch {
        setToast({ message: 'Failed to move task', type: 'error' })
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

  // Mouse back/forward buttons (button 3 = back, button 4 = forward)
  useEffect(() => {
    const handleMouseButton = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault()
        goBack()
      } else if (e.button === 4) {
        e.preventDefault()
        goForward()
      }
    }
    window.addEventListener('mouseup', handleMouseButton)
    return () => window.removeEventListener('mouseup', handleMouseButton)
  }, [goBack, goForward])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isInput = isInputFocused()

      // Navigate back: Alt+Left
      if (e.key === 'ArrowLeft' && e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        goBack()
        return
      }

      // Navigate forward: Alt+Right
      if (e.key === 'ArrowRight' && e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        goForward()
        return
      }

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

      // Open settings: comma
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowSettings(true)
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
  }, [setView, toggleSidebar, goBack, goForward])

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
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-background">
        {!sidebarCollapsed && (
          <Sidebar
            currentView={currentView}
            currentViewId={currentViewId ?? undefined}
            onViewChange={setView}
            onQuickAdd={() => setQuickAddOpen(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenProductivity={() => setShowProductivity(true)}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navigation bar */}
          <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-background/95 backdrop-blur-sm flex-shrink-0">
            <button
              onClick={goBack}
              disabled={!canGoBack()}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Go back (Alt+Left)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goForward}
              disabled={!canGoForward()}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Go forward (Alt+Right)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <main className="flex-1 overflow-auto" key={refreshKey}>
            {renderView()}
          </main>
        </div>
        <QuickAddModal
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          onTaskCreated={() => setRefreshKey((k) => k + 1)}
        />
        <KeyboardShortcutsHelp
          open={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
        />
        <SettingsPanel
          open={showSettings}
          onClose={() => setShowSettings(false)}
        />
        <ProductivityPanel
          open={showProductivity}
          onClose={() => setShowProductivity(false)}
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
