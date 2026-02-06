import { describe, it, expect, beforeEach } from 'vitest'

// Mock zustand store for testing
// We test the navigation logic directly

interface NavigationEntry {
  view: string
  id: string | null
}

interface NavState {
  currentView: string
  currentViewId: string | null
  navHistory: NavigationEntry[]
  navHistoryIndex: number
}

function createNavStore() {
  let state: NavState = {
    currentView: 'today',
    currentViewId: null,
    navHistory: [{ view: 'today', id: null }],
    navHistoryIndex: 0
  }

  return {
    getState: () => state,
    setView: (view: string, id?: string) => {
      const newEntry: NavigationEntry = { view, id: id ?? null }
      const current = state.navHistory[state.navHistoryIndex]
      if (current && current.view === newEntry.view && current.id === newEntry.id) {
        return
      }
      const newHistory = state.navHistory.slice(0, state.navHistoryIndex + 1)
      newHistory.push(newEntry)
      if (newHistory.length > 50) {
        newHistory.shift()
      }
      state = {
        currentView: view,
        currentViewId: id ?? null,
        navHistory: newHistory,
        navHistoryIndex: newHistory.length - 1
      }
    },
    goBack: () => {
      if (state.navHistoryIndex <= 0) return
      const newIndex = state.navHistoryIndex - 1
      const entry = state.navHistory[newIndex]
      state = {
        ...state,
        currentView: entry.view,
        currentViewId: entry.id,
        navHistoryIndex: newIndex
      }
    },
    goForward: () => {
      if (state.navHistoryIndex >= state.navHistory.length - 1) return
      const newIndex = state.navHistoryIndex + 1
      const entry = state.navHistory[newIndex]
      state = {
        ...state,
        currentView: entry.view,
        currentViewId: entry.id,
        navHistoryIndex: newIndex
      }
    },
    canGoBack: () => state.navHistoryIndex > 0,
    canGoForward: () => state.navHistoryIndex < state.navHistory.length - 1
  }
}

describe('Navigation History', () => {
  let store: ReturnType<typeof createNavStore>

  beforeEach(() => {
    store = createNavStore()
  })

  it('should start with today view and no back history', () => {
    expect(store.getState().currentView).toBe('today')
    expect(store.canGoBack()).toBe(false)
    expect(store.canGoForward()).toBe(false)
  })

  it('should track navigation history', () => {
    store.setView('inbox')
    expect(store.getState().currentView).toBe('inbox')
    expect(store.getState().navHistory).toHaveLength(2)
    expect(store.canGoBack()).toBe(true)
    expect(store.canGoForward()).toBe(false)
  })

  it('should go back to previous view', () => {
    store.setView('inbox')
    store.setView('upcoming')

    store.goBack()
    expect(store.getState().currentView).toBe('inbox')
    expect(store.canGoBack()).toBe(true)
    expect(store.canGoForward()).toBe(true)
  })

  it('should go forward after going back', () => {
    store.setView('inbox')
    store.setView('upcoming')

    store.goBack()
    store.goForward()
    expect(store.getState().currentView).toBe('upcoming')
    expect(store.canGoForward()).toBe(false)
  })

  it('should truncate forward history when navigating to new view', () => {
    store.setView('inbox')
    store.setView('upcoming')
    store.setView('calendar')

    store.goBack() // upcoming
    store.goBack() // inbox

    // Navigate to a new view - should truncate forward history
    store.setView('search')

    expect(store.getState().currentView).toBe('search')
    expect(store.canGoForward()).toBe(false)
    expect(store.getState().navHistory).toHaveLength(3) // today, inbox, search
  })

  it('should not add duplicate entries', () => {
    store.setView('inbox')
    store.setView('inbox') // duplicate

    expect(store.getState().navHistory).toHaveLength(2) // today, inbox
  })

  it('should track view IDs', () => {
    store.setView('project', 'project-123')
    expect(store.getState().currentView).toBe('project')
    expect(store.getState().currentViewId).toBe('project-123')

    store.setView('inbox')
    store.goBack()

    expect(store.getState().currentView).toBe('project')
    expect(store.getState().currentViewId).toBe('project-123')
  })

  it('should do nothing when going back at start', () => {
    store.goBack()
    expect(store.getState().currentView).toBe('today')
    expect(store.getState().navHistoryIndex).toBe(0)
  })

  it('should do nothing when going forward at end', () => {
    store.setView('inbox')
    store.goForward()
    expect(store.getState().currentView).toBe('inbox')
  })

  it('should respect max history size', () => {
    // Navigate to 55 different views
    for (let i = 0; i < 55; i++) {
      store.setView('project', `project-${i}`)
    }

    // History should be capped at 50
    expect(store.getState().navHistory.length).toBeLessThanOrEqual(51) // initial + 50
  })

  it('should navigate through multiple views correctly', () => {
    store.setView('inbox')
    store.setView('project', 'p1')
    store.setView('label', 'l1')
    store.setView('filter', 'f1')

    // Go back 3 times
    store.goBack() // label
    store.goBack() // project
    store.goBack() // inbox

    expect(store.getState().currentView).toBe('inbox')

    // Go forward 2 times
    store.goForward() // project
    store.goForward() // label

    expect(store.getState().currentView).toBe('label')
    expect(store.getState().currentViewId).toBe('l1')
  })
})
