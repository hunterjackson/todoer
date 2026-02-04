import React, { useState, useEffect } from 'react'
import { X, Settings, Moon, Sun, Monitor, Bell, Trash2, Globe, Clock, Calendar, FolderKanban } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { useProjects } from '@hooks/useProjects'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

type ThemeOption = 'light' | 'dark' | 'system'

export function SettingsPanel({ open, onClose }: SettingsPanelProps): React.ReactElement | null {
  const { theme, setTheme } = useStore()
  const { projects, refresh: refreshProjects } = useProjects()
  const [dailyGoal, setDailyGoal] = useState(5)
  const [confirmDelete, setConfirmDelete] = useState(true)
  const [showCompletedTasks, setShowCompletedTasks] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [weekStart, setWeekStart] = useState(0) // 0 = Sunday, 1 = Monday
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [dateFormat, setDateFormat] = useState<'mdy' | 'dmy' | 'ymd'>('mdy')
  const [defaultProjectId, setDefaultProjectId] = useState<string>('inbox')

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const dailyGoalVal = await window.api.settings.get('dailyGoal')
        if (dailyGoalVal) setDailyGoal(parseInt(dailyGoalVal, 10))

        const confirmDeleteVal = await window.api.settings.get('confirmDelete')
        if (confirmDeleteVal) setConfirmDelete(confirmDeleteVal === 'true')

        const showCompletedVal = await window.api.settings.get('showCompletedTasks')
        if (showCompletedVal) setShowCompletedTasks(showCompletedVal === 'true')

        const notificationsVal = await window.api.settings.get('notificationsEnabled')
        if (notificationsVal) setNotificationsEnabled(notificationsVal === 'true')

        const weekStartVal = await window.api.settings.get('weekStart')
        if (weekStartVal) setWeekStart(parseInt(weekStartVal, 10))

        const timeFormatVal = await window.api.settings.get('timeFormat')
        if (timeFormatVal) setTimeFormat(timeFormatVal as '12h' | '24h')

        const dateFormatVal = await window.api.settings.get('dateFormat')
        if (dateFormatVal) setDateFormat(dateFormatVal as 'mdy' | 'dmy' | 'ymd')

        const defaultProjectVal = await window.api.settings.get('defaultProject')
        if (defaultProjectVal) setDefaultProjectId(defaultProjectVal)
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }

    if (open) {
      loadSettings()
      refreshProjects()
    }
  }, [open, refreshProjects])

  // Save setting helper
  const saveSetting = async (key: string, value: string) => {
    try {
      await window.api.settings.set(key, value)
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err)
    }
  }

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
                value={dailyGoal}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  setDailyGoal(val)
                  saveSetting('dailyGoal', String(val))
                }}
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-right">
                {dailyGoal} tasks
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
                    setWeekStart(option.value)
                    saveSetting('weekStart', String(option.value))
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                    weekStart === option.value
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
                    setTimeFormat(option.value as '12h' | '24h')
                    saveSetting('timeFormat', option.value)
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                    timeFormat === option.value
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
                    setDateFormat(option.value as 'mdy' | 'dmy' | 'ymd')
                    saveSetting('dateFormat', option.value)
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                    dateFormat === option.value
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
              value={defaultProjectId}
              onChange={(e) => {
                setDefaultProjectId(e.target.value)
                saveSetting('defaultProject', e.target.value)
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
                  const newVal = !notificationsEnabled
                  setNotificationsEnabled(newVal)
                  saveSetting('notificationsEnabled', String(newVal))
                }}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  notificationsEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    notificationsEnabled ? 'translate-x-4' : ''
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
                    const newVal = !confirmDelete
                    setConfirmDelete(newVal)
                    saveSetting('confirmDelete', String(newVal))
                  }}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    confirmDelete ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      confirmDelete ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">Show completed tasks</span>
                <button
                  onClick={() => {
                    const newVal = !showCompletedTasks
                    setShowCompletedTasks(newVal)
                    saveSetting('showCompletedTasks', String(newVal))
                  }}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    showCompletedTasks ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      showCompletedTasks ? 'translate-x-4' : ''
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
