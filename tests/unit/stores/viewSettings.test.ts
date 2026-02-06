import { describe, it, expect, beforeEach } from 'vitest'

// Test the view settings logic directly (same pattern as navigation history tests)
interface ViewSettings {
  sortField: string
  sortDirection: string
  groupBy: string
  showCompleted: boolean
}

const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  sortField: 'default',
  sortDirection: 'asc',
  groupBy: 'none',
  showCompleted: false
}

function createViewSettingsStore() {
  let viewSettings: Record<string, ViewSettings> = {}

  return {
    getViewSettings: (viewKey: string): ViewSettings => {
      return viewSettings[viewKey] || DEFAULT_VIEW_SETTINGS
    },
    setViewSettings: (viewKey: string, settings: Partial<ViewSettings>) => {
      viewSettings = {
        ...viewSettings,
        [viewKey]: {
          ...(viewSettings[viewKey] || DEFAULT_VIEW_SETTINGS),
          ...settings
        }
      }
    },
    getAllSettings: () => viewSettings
  }
}

describe('View Settings Store', () => {
  let store: ReturnType<typeof createViewSettingsStore>

  beforeEach(() => {
    store = createViewSettingsStore()
  })

  it('should return default settings for unknown view', () => {
    const settings = store.getViewSettings('inbox')
    expect(settings).toEqual(DEFAULT_VIEW_SETTINGS)
  })

  it('should persist sort field per view', () => {
    store.setViewSettings('inbox', { sortField: 'priority' })
    store.setViewSettings('today', { sortField: 'dueDate' })

    expect(store.getViewSettings('inbox').sortField).toBe('priority')
    expect(store.getViewSettings('today').sortField).toBe('dueDate')
  })

  it('should persist sort direction per view', () => {
    store.setViewSettings('inbox', { sortDirection: 'desc' })
    expect(store.getViewSettings('inbox').sortDirection).toBe('desc')
    expect(store.getViewSettings('today').sortDirection).toBe('asc') // unchanged
  })

  it('should persist group by per view', () => {
    store.setViewSettings('project-123', { groupBy: 'priority' })
    expect(store.getViewSettings('project-123').groupBy).toBe('priority')
  })

  it('should persist show completed per view', () => {
    store.setViewSettings('inbox', { showCompleted: true })
    expect(store.getViewSettings('inbox').showCompleted).toBe(true)
    expect(store.getViewSettings('today').showCompleted).toBe(false) // default
  })

  it('should handle multiple settings at once', () => {
    store.setViewSettings('inbox', {
      sortField: 'alphabetical',
      sortDirection: 'desc',
      groupBy: 'project',
      showCompleted: true
    })

    const settings = store.getViewSettings('inbox')
    expect(settings.sortField).toBe('alphabetical')
    expect(settings.sortDirection).toBe('desc')
    expect(settings.groupBy).toBe('project')
    expect(settings.showCompleted).toBe(true)
  })

  it('should update without losing existing settings', () => {
    store.setViewSettings('inbox', { sortField: 'priority' })
    store.setViewSettings('inbox', { groupBy: 'dueDate' })

    const settings = store.getViewSettings('inbox')
    expect(settings.sortField).toBe('priority') // still set
    expect(settings.groupBy).toBe('dueDate') // newly set
  })

  it('should support per-project view keys', () => {
    store.setViewSettings('project-abc', { sortField: 'dueDate' })
    store.setViewSettings('project-xyz', { sortField: 'priority' })

    expect(store.getViewSettings('project-abc').sortField).toBe('dueDate')
    expect(store.getViewSettings('project-xyz').sortField).toBe('priority')
  })

  it('should support label and filter view keys', () => {
    store.setViewSettings('label-123', { groupBy: 'priority' })
    store.setViewSettings('filter-456', { sortField: 'alphabetical' })

    expect(store.getViewSettings('label-123').groupBy).toBe('priority')
    expect(store.getViewSettings('filter-456').sortField).toBe('alphabetical')
  })

  it('should not affect other views when updating one', () => {
    store.setViewSettings('inbox', { sortField: 'priority' })
    store.setViewSettings('today', { sortField: 'dueDate' })

    store.setViewSettings('inbox', { sortField: 'alphabetical' })

    expect(store.getViewSettings('inbox').sortField).toBe('alphabetical')
    expect(store.getViewSettings('today').sortField).toBe('dueDate') // unchanged
  })
})
