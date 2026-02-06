import { useState, useEffect, useCallback } from 'react'

export interface AppSettings {
  confirmDelete: boolean
  weekStart: number
  timeFormat: '12h' | '24h'
  dateFormat: 'mdy' | 'dmy' | 'ymd'
  notificationsEnabled: boolean
  dailyGoal: number
  defaultProject: string
}

const defaultSettings: AppSettings = {
  confirmDelete: true,
  weekStart: 0, // Sunday
  timeFormat: '12h',
  dateFormat: 'mdy',
  notificationsEnabled: true,
  dailyGoal: 5,
  defaultProject: 'inbox'
}

// Cache settings in memory for fast access
let settingsCache: AppSettings | null = null
let loadingPromise: Promise<void> | null = null

async function loadSettingsToCache(): Promise<void> {
  if (settingsCache) return
  if (loadingPromise) {
    await loadingPromise
    return
  }

  loadingPromise = (async () => {
    const settings: AppSettings = { ...defaultSettings }

    try {
      const confirmDeleteVal = await window.api.settings.get('confirmDelete')
      if (confirmDeleteVal !== null) settings.confirmDelete = confirmDeleteVal === 'true'

      const weekStartVal = await window.api.settings.get('weekStart')
      if (weekStartVal !== null) settings.weekStart = parseInt(weekStartVal, 10)

      const timeFormatVal = await window.api.settings.get('timeFormat')
      if (timeFormatVal !== null) settings.timeFormat = timeFormatVal as '12h' | '24h'

      const dateFormatVal = await window.api.settings.get('dateFormat')
      if (dateFormatVal !== null) settings.dateFormat = dateFormatVal as 'mdy' | 'dmy' | 'ymd'

      const notificationsVal = await window.api.settings.get('notificationsEnabled')
      if (notificationsVal !== null) settings.notificationsEnabled = notificationsVal === 'true'

      const dailyGoalVal = await window.api.settings.get('dailyGoal')
      if (dailyGoalVal !== null) settings.dailyGoal = parseInt(dailyGoalVal, 10)

      const defaultProjectVal = await window.api.settings.get('defaultProject')
      if (defaultProjectVal !== null) settings.defaultProject = defaultProjectVal
    } catch {
      // Use defaults on error
    }

    settingsCache = settings
  })()

  await loadingPromise
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(settingsCache || defaultSettings)
  const [loading, setLoading] = useState(!settingsCache)

  useEffect(() => {
    if (!settingsCache) {
      loadSettingsToCache().then(() => {
        setSettings(settingsCache!)
        setLoading(false)
      })
    }
  }, [])

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    // Update cache
    if (settingsCache) {
      settingsCache[key] = value
    }
    setSettings((prev) => ({ ...prev, [key]: value }))

    // Persist
    try {
      await window.api.settings.set(key, String(value))
    } catch {
      // Ignore errors
    }
  }, [])

  const refreshSettings = useCallback(async () => {
    settingsCache = null
    loadingPromise = null
    await loadSettingsToCache()
    setSettings(settingsCache!)
  }, [])

  return { settings, loading, updateSetting, refreshSettings }
}

// Convenience hook for confirm delete
export function useConfirmDelete() {
  const { settings } = useSettings()

  return useCallback(
    async (message: string): Promise<boolean> => {
      if (!settings.confirmDelete) return true
      return confirm(message)
    },
    [settings.confirmDelete]
  )
}
