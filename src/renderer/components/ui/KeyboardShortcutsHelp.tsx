import React, { useEffect, useMemo } from 'react'
import { X, Keyboard } from 'lucide-react'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { parseShortcutDisplay, type ShortcutCategory, type ShortcutDefinition } from '@shared/shortcuts'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

const CATEGORY_DISPLAY: Record<ShortcutCategory, string> = {
  'General': 'General',
  'Navigation': 'Navigation',
  'Task List': 'Task List (hover over list)'
}

export function KeyboardShortcutsHelp({
  open,
  onClose
}: KeyboardShortcutsHelpProps): React.ReactElement | null {
  const { getShortcuts } = useKeyboardShortcuts()

  const groupedShortcuts = useMemo(() => {
    const shortcuts = getShortcuts()
    const groups = new Map<ShortcutCategory, ShortcutDefinition[]>()
    for (const s of shortcuts) {
      const list = groups.get(s.category) || []
      list.push(s)
      groups.set(s.category, list)
    }
    return groups
  }, [getShortcuts])

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
          {Array.from(groupedShortcuts.entries()).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {CATEGORY_DISPLAY[category]}
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut) => {
                  const keyParts = parseShortcutDisplay(shortcut.binding)
                  return (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{shortcut.label}</span>
                      <div className="flex items-center gap-1">
                        {keyParts.map((part, index) => (
                          <React.Fragment key={index}>
                            {part === 'then' ? (
                              <span className="text-xs text-muted-foreground mx-1">
                                then
                              </span>
                            ) : (
                              <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                                {part}
                              </kbd>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
