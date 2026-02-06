import React, { useEffect } from 'react'
import { X, Settings, Moon, Sun, Monitor, Bell, Trash2, Globe, Clock, Calendar, FolderKanban } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { useProjects } from '@hooks/useProjects'
import { useSettings } from '@hooks/useSettings'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

type ThemeOption = 'light' | 'dark' | 'system'

export function SettingsPanel({ open, onClose }: SettingsPanelProps): React.ReactElement | null {
  const { theme, setTheme } = useStore()
  const { projects, refresh: refreshProjects } = useProjects()
  const { settings, updateSetting, refreshSettings } = useSettings()

  // Refresh settings and projects when panel opens
  useEffect(() => {
    if (open) {
      refreshSettings()
      refreshProjects()
    }
  }, [open, refreshProjects, refreshSettings])

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
              value={settings.defaultProject}
              onChange={(e) => {
                updateSetting('defaultProject', e.target.value)
              }}
              className="w-full py-2 px-3 text-sm rounded-lg border border-border bg-background cursor-pointer hover:border-primary/50"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
