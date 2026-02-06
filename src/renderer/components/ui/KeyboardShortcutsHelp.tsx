import React, { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  {
    category: 'General',
    items: [
      { keys: ['Q'], description: 'Quick add task' },
      { keys: ['/'], description: 'Search' },
      { keys: ['M'], description: 'Toggle sidebar' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal/dialog' },
      { keys: ['Cmd+Z'], description: 'Undo' },
      { keys: ['Cmd+Shift+Z'], description: 'Redo' },
      { keys: ['Cmd+,'], description: 'Open Settings' }
    ]
  },
  {
    category: 'Navigation',
    items: [
      { keys: ['G', 'T'], description: 'Go to Today' },
      { keys: ['G', 'I'], description: 'Go to Inbox' },
      { keys: ['G', 'U'], description: 'Go to Upcoming' },
      { keys: ['G', 'C'], description: 'Go to Calendar' }
    ]
  },
  {
    category: 'Task List (hover over list)',
    items: [
      { keys: ['J / K'], description: 'Move focus down / up' },
      { keys: ['Tab / Shift+Tab'], description: 'Indent / outdent task' },
      { keys: ['E'], description: 'Complete/uncomplete focused task' },
      { keys: ['1-4'], description: 'Set priority' },
      { keys: ['Enter'], description: 'Edit focused task' },
      { keys: ['H / L'], description: 'Collapse / expand subtasks' },
      { keys: ['Cmd+Delete'], description: 'Delete focused task' }
    ]
  }
]

export function KeyboardShortcutsHelp({
  open,
  onClose
}: KeyboardShortcutsHelpProps): React.ReactElement | null {
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {keyIndex > 0 && (
                            <span className="text-xs text-muted-foreground mx-1">
                              then
                            </span>
                          )}
                          <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
