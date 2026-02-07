import React, { useEffect, useState, useCallback } from 'react'
import { X, Settings, Moon, Sun, Monitor, Bell, Trash2, Globe, Clock, Calendar, FolderKanban, Keyboard, RotateCcw } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { useProjects } from '@hooks/useProjects'
import { useSettings } from '@hooks/useSettings'
import { INBOX_PROJECT_ID } from '@shared/constants'
import { getSelectableDefaultProjects, resolveDefaultProjectId } from '@renderer/lib/defaultProject'
import {
  DEFAULT_SHORTCUTS,
  detectConflicts,
  mergeShortcuts,
  parseShortcutDisplay,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutCategory
} from '@shared/shortcuts'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

type ThemeOption = 'light' | 'dark' | 'system'

function ShortcutEditor({
  overrides,
  onUpdate
}: {
  overrides: Record<string, ShortcutBinding>
  onUpdate: (newOverrides: Record<string, ShortcutBinding>) => void
}) {
  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null)

  const merged = mergeShortcuts(DEFAULT_SHORTCUTS, overrides)
  const conflicts = detectConflicts(merged)
  const conflictSet = new Set(conflicts.flatMap(([a, b]) => [a, b]))

  // Group by category
  const grouped = new Map<ShortcutCategory, typeof merged>()
  for (const s of merged) {
    const list = grouped.get(s.category) || []
    list.push(s)
    grouped.set(s.category, list)
  }

  const handleKeyCapture = useCallback((e: KeyboardEvent) => {
    if (!editingAction) return
    // Ignore lone modifier keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

    e.preventDefault()
    e.stopPropagation()

    const newBinding: ShortcutBinding = {
      key: e.key,
      ...(e.ctrlKey || e.metaKey ? { ctrl: true } : {}),
      ...(e.shiftKey ? { shift: true } : {}),
      ...(e.altKey ? { alt: true } : {})
    }

    // If Escape is pressed with no modifiers, cancel editing
    if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      setEditingAction(null)
      return
    }

    const newOverrides = { ...overrides, [editingAction]: newBinding }
    onUpdate(newOverrides)
    setEditingAction(null)
  }, [editingAction, overrides, onUpdate])

  useEffect(() => {
    if (editingAction) {
      window.addEventListener('keydown', handleKeyCapture, true)
      return () => window.removeEventListener('keydown', handleKeyCapture, true)
    }
  }, [editingAction, handleKeyCapture])

  const handleReset = (action: ShortcutAction) => {
    const newOverrides = { ...overrides }
    delete newOverrides[action]
    onUpdate(newOverrides)
  }

  const handleResetAll = () => {
    onUpdate({})
  }

  const hasOverrides = Object.keys(overrides).length > 0

  return (
    <div className="space-y-3">
      {hasOverrides && (
        <div className="flex justify-end">
          <button
            onClick={handleResetAll}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all to defaults
          </button>
        </div>
      )}
      {Array.from(grouped.entries()).map(([category, shortcuts]) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{category}</h4>
          <div className="space-y-1">
            {shortcuts.map((shortcut) => {
              const isEditing = editingAction === shortcut.action
              const isConflict = conflictSet.has(shortcut.action)
              const isOverridden = shortcut.action in overrides
              const keyParts = parseShortcutDisplay(shortcut.binding)

              return (
                <div
                  key={shortcut.action}
                  className={`flex items-center justify-between py-1 px-2 rounded text-sm ${
                    isConflict ? 'bg-destructive/10' : ''
                  }`}
                >
                  <span className="text-sm flex-1 mr-2">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <span className="px-2 py-1 text-xs font-mono bg-primary/20 border border-primary rounded animate-pulse">
                        Press a key...
                      </span>
                    ) : (
                      <button
                        onClick={() => setEditingAction(shortcut.action)}
                        className="flex items-center gap-1 hover:opacity-80"
                        title="Click to change shortcut"
                      >
                        {keyParts.map((part, i) => (
                          <React.Fragment key={i}>
                            {part === 'then' ? (
                              <span className="text-xs text-muted-foreground mx-0.5">then</span>
                            ) : (
                              <kbd className={`px-1.5 py-0.5 text-xs font-mono rounded border ${
                                isOverridden ? 'bg-primary/10 border-primary/30' : 'bg-muted'
                              }`}>
                                {part}
                              </kbd>
                            )}
                          </React.Fragment>
                        ))}
                      </button>
                    )}
                    {isOverridden && !isEditing && (
                      <button
                        onClick={() => handleReset(shortcut.action)}
                        className="p-0.5 rounded hover:bg-accent"
                        title="Reset to default"
                      >
                        <RotateCcw className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {conflicts.length > 0 && (
        <p className="text-xs text-destructive mt-1">
          Warning: Some shortcuts have conflicting bindings
        </p>
      )}
    </div>
  )
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps): React.ReactElement | null {
  const { theme, setTheme } = useStore()
  const { projects, loading: projectsLoading, refresh: refreshProjects } = useProjects()
  const { settings, updateSetting, refreshSettings } = useSettings()

  // Refresh settings and projects when panel opens
  useEffect(() => {
    if (open) {
      refreshSettings()
      refreshProjects()
    }
  }, [open, refreshProjects, refreshSettings])

  const selectableDefaultProjects = getSelectableDefaultProjects(projects)
  const resolvedDefaultProjectId = resolveDefaultProjectId(settings.defaultProject, projects)

  // Keep persisted default project aligned with active (non-archived) options.
  useEffect(() => {
    if (!open || projectsLoading) return
    if (settings.defaultProject !== resolvedDefaultProjectId) {
      updateSetting('defaultProject', resolvedDefaultProjectId)
    }
  }, [open, projectsLoading, settings.defaultProject, resolvedDefaultProjectId, updateSetting])

  // Handle escape key
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const themeOptions: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Theme */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sun className="w-4 h-4" /> Appearance
            </h3>
            <div className="flex gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
                    theme === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {option.icon}
                  <span className="text-sm">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Daily Goal */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Daily Goal
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="20"
                value={settings.dailyGoal}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  updateSetting('dailyGoal', val)
                  // Also update karma engine's daily goal
                  window.api.karma.updateGoals({ dailyGoal: val }).catch(() => {})
                }}
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-right">
                {settings.dailyGoal} tasks
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Number of tasks to complete each day
            </p>
          </div>

          {/* Weekly Goal */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Weekly Goal
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={settings.weeklyGoal}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  updateSetting('weeklyGoal', val)
                  window.api.karma.updateGoals({ weeklyGoal: val }).catch(() => {})
                }}
                className="flex-1"
              />
              <span className="text-sm font-medium w-16 text-right">
                {settings.weeklyGoal} tasks
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Number of tasks to complete each week
            </p>
          </div>

          {/* Week Start */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Week Starts On
            </h3>
            <div className="flex gap-2">
              {[
                { value: 0, label: 'Sunday' },
                { value: 1, label: 'Monday' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    updateSetting('weekStart', option.value)
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                    settings.weekStart === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Format */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Time Format
            </h3>
            <div className="flex gap-2">
              {[
                { value: '12h', label: '12-hour (AM/PM)' },
                { value: '24h', label: '24-hour' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    updateSetting('timeFormat', option.value as '12h' | '24h')
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                    settings.timeFormat === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Format */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Date Format
            </h3>
            <div className="flex gap-2">
              {[
                { value: 'mdy', label: 'MM/DD/YYYY' },
                { value: 'dmy', label: 'DD/MM/YYYY' },
                { value: 'ymd', label: 'YYYY-MM-DD' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    updateSetting('dateFormat', option.value as 'mdy' | 'dmy' | 'ymd')
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                    settings.dateFormat === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Default Project */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FolderKanban className="w-4 h-4" /> Default Project
            </h3>
            <select
              value={resolvedDefaultProjectId}
              onChange={(e) => {
                updateSetting('defaultProject', e.target.value)
              }}
              className="w-full py-2 px-3 text-sm rounded-lg border border-border bg-background cursor-pointer hover:border-primary/50"
            >
              {selectableDefaultProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {selectableDefaultProjects.length === 0 && (
                <option value={INBOX_PROJECT_ID}>Inbox</option>
              )}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              New tasks will be created in this project by default
            </p>
          </div>

          {/* Notifications */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </h3>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Enable reminders</span>
              <button
                onClick={() => {
                  const newVal = !settings.notificationsEnabled
                  updateSetting('notificationsEnabled', newVal)
                  window.api.notifications.setEnabled(newVal).catch(() => {})
                }}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  settings.notificationsEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.notificationsEnabled ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </label>
            {settings.notificationsEnabled && (
              <div className="mt-3 space-y-2">
                <span className="text-sm text-muted-foreground">Quiet hours (no notifications)</span>
                <div className="flex items-center gap-2">
                  <select
                    value={settings.quietHoursStart}
                    onChange={(e) => {
                      const start = parseInt(e.target.value, 10)
                      updateSetting('quietHoursStart', start)
                      window.api.notifications.setQuietHours(start, settings.quietHoursEnd).catch(() => {})
                    }}
                    className="py-1.5 px-2 text-sm rounded-lg border border-border bg-background"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-muted-foreground">to</span>
                  <select
                    value={settings.quietHoursEnd}
                    onChange={(e) => {
                      const end = parseInt(e.target.value, 10)
                      updateSetting('quietHoursEnd', end)
                      window.api.notifications.setQuietHours(settings.quietHoursStart, end).catch(() => {})
                    }}
                    className="py-1.5 px-2 text-sm rounded-lg border border-border bg-background"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Behavior */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Behavior
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">Confirm before deleting</span>
                <button
                  onClick={() => {
                    updateSetting('confirmDelete', !settings.confirmDelete)
                  }}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    settings.confirmDelete ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.confirmDelete ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              </label>

            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4" /> Keyboard Shortcuts
            </h3>
            <ShortcutEditor
              overrides={settings.keyboardShortcuts}
              onUpdate={(newOverrides) => updateSetting('keyboardShortcuts', newOverrides)}
            />
          </div>

          {/* Data */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Data
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => window.api.data.exportJSON()}
                className="w-full py-2 px-3 text-sm rounded-lg border border-border hover:border-primary/50 text-left"
              >
                Export all data (JSON)
              </button>
              <button
                onClick={() => window.api.data.exportCSV()}
                className="w-full py-2 px-3 text-sm rounded-lg border border-border hover:border-primary/50 text-left"
              >
                Export tasks (CSV)
              </button>
              <button
                onClick={() => window.api.data.importJSON()}
                className="w-full py-2 px-3 text-sm rounded-lg border border-border hover:border-primary/50 text-left"
              >
                Import from JSON
              </button>
            </div>
          </div>

          {/* Version */}
          <div className="pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">Todoer v0.1.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
