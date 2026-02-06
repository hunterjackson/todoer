import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ViewType } from '@shared/types'

interface NavigationEntry {
  view: ViewType
  id: string | null
}

export type SortField = 'default' | 'priority' | 'dueDate' | 'alphabetical' | 'dateAdded'
export type SortDirection = 'asc' | 'desc'
export type GroupBy = 'none' | 'priority' | 'project' | 'dueDate'

export interface ViewSettings {
  sortField: SortField
  sortDirection: SortDirection
  groupBy: GroupBy
  showCompleted: boolean
}

const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  sortField: 'default',
  sortDirection: 'asc',
  groupBy: 'none',
  showCompleted: false
}

interface AppState {
  // Navigation
  currentView: ViewType
  currentViewId: string | null
  searchQuery: string

  // Navigation history
  navHistory: NavigationEntry[]
  navHistoryIndex: number

  // UI state
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'

  // Per-view settings
  viewSettings: Record<string, ViewSettings>

  // Actions
  setView: (view: ViewType, id?: string) => void
  setSearchQuery: (query: string) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  goBack: () => void
  goForward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  getViewSettings: (viewKey: string) => ViewSettings
  setViewSettings: (viewKey: string, settings: Partial<ViewSettings>) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentView: 'today',
      currentViewId: null,
      searchQuery: '',
      navHistory: [{ view: 'today', id: null }],
      navHistoryIndex: 0,
      sidebarCollapsed: false,
      theme: 'system',
      viewSettings: {},

      // Actions
      setView: (view, id) => {
        const state = get()
        const newEntry: NavigationEntry = { view, id: id ?? null }

        // Don't push duplicate entries
        const current = state.navHistory[state.navHistoryIndex]
        if (current && current.view === newEntry.view && current.id === newEntry.id) {
          return
        }

        // Truncate forward history and push new entry
        const newHistory = state.navHistory.slice(0, state.navHistoryIndex + 1)
        newHistory.push(newEntry)

        // Keep history bounded (max 50 entries)
        if (newHistory.length > 50) {
          newHistory.shift()
        }

        set({
          currentView: view,
          currentViewId: id ?? null,
          searchQuery: view === 'search' ? '' : '',
          navHistory: newHistory,
          navHistoryIndex: newHistory.length - 1
        })
      },

      setSearchQuery: (query) => {
        const state = get()
        const newEntry: NavigationEntry = { view: 'search', id: null }
        const current = state.navHistory[state.navHistoryIndex]

        // If already on search, just update query
        if (current && current.view === 'search') {
          set({ searchQuery: query, currentView: 'search' })
          return
        }

        const newHistory = state.navHistory.slice(0, state.navHistoryIndex + 1)
        newHistory.push(newEntry)

        set({
          searchQuery: query,
          currentView: 'search',
          navHistory: newHistory,
          navHistoryIndex: newHistory.length - 1
        })
      },

      goBack: () => {
        const state = get()
        if (state.navHistoryIndex <= 0) return

        const newIndex = state.navHistoryIndex - 1
        const entry = state.navHistory[newIndex]

        set({
          currentView: entry.view,
          currentViewId: entry.id,
          navHistoryIndex: newIndex,
          searchQuery: ''
        })
      },

      goForward: () => {
        const state = get()
        if (state.navHistoryIndex >= state.navHistory.length - 1) return

        const newIndex = state.navHistoryIndex + 1
        const entry = state.navHistory[newIndex]

        set({
          currentView: entry.view,
          currentViewId: entry.id,
          navHistoryIndex: newIndex,
          searchQuery: ''
        })
      },

      canGoBack: () => {
        return get().navHistoryIndex > 0
      },

      canGoForward: () => {
        const state = get()
        return state.navHistoryIndex < state.navHistory.length - 1
      },

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setTheme: (theme) => set({ theme }),

      getViewSettings: (viewKey) => {
        const state = get()
        return state.viewSettings[viewKey] || DEFAULT_VIEW_SETTINGS
      },

      setViewSettings: (viewKey, settings) => {
        set((state) => ({
          viewSettings: {
            ...state.viewSettings,
            [viewKey]: {
              ...(state.viewSettings[viewKey] || DEFAULT_VIEW_SETTINGS),
              ...settings
            }
          }
        }))
      }
    }),
    {
      name: 'todoer-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        viewSettings: state.viewSettings
      })
    }
  )
)
