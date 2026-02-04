import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ViewType } from '@shared/types'

interface AppState {
  // Navigation
  currentView: ViewType
  currentViewId: string | null
  searchQuery: string

  // UI state
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'

  // Actions
  setView: (view: ViewType, id?: string) => void
  setSearchQuery: (query: string) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentView: 'today',
      currentViewId: null,
      searchQuery: '',
      sidebarCollapsed: false,
      theme: 'system',

      // Actions
      setView: (view, id) =>
        set({
          currentView: view,
          currentViewId: id ?? null,
          searchQuery: view === 'search' ? '' : ''
        }),

      setSearchQuery: (query) =>
        set({
          searchQuery: query,
          currentView: 'search'
        }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'todoer-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme
      })
    }
  )
)
