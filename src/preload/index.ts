import { contextBridge, ipcRenderer } from 'electron'
import type { Task, TaskCreate, TaskUpdate } from '@shared/types'
import type { Project, ProjectCreate, ProjectUpdate } from '@shared/types'
import type { Label, LabelCreate, LabelUpdate } from '@shared/types'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const api = {
  // Task operations
  tasks: {
    list: (filter?: { projectId?: string; labelId?: string; completed?: boolean; dueDate?: string }) =>
      ipcRenderer.invoke('tasks:list', filter),
    get: (id: string) => ipcRenderer.invoke('tasks:get', id),
    create: (data: TaskCreate) => ipcRenderer.invoke('tasks:create', data),
    update: (id: string, data: TaskUpdate) => ipcRenderer.invoke('tasks:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('tasks:delete', id),
    complete: (id: string) => ipcRenderer.invoke('tasks:complete', id),
    uncomplete: (id: string) => ipcRenderer.invoke('tasks:uncomplete', id),
    reorder: (taskId: string, newOrder: number, newParentId?: string | null) =>
      ipcRenderer.invoke('tasks:reorder', taskId, newOrder, newParentId),
    getToday: () => ipcRenderer.invoke('tasks:getToday'),
    getUpcoming: (days: number) => ipcRenderer.invoke('tasks:getUpcoming', days),
    getOverdue: () => ipcRenderer.invoke('tasks:getOverdue'),
    search: (query: string) => ipcRenderer.invoke('tasks:search', query),
    getLabels: (taskId: string) => ipcRenderer.invoke('tasks:getLabels', taskId),
    getByLabel: (labelId: string) => ipcRenderer.invoke('tasks:getByLabel', labelId)
  },

  // Project operations
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id),
    create: (data: ProjectCreate) => ipcRenderer.invoke('projects:create', data),
    update: (id: string, data: ProjectUpdate) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    reorder: (projectId: string, newOrder: number) =>
      ipcRenderer.invoke('projects:reorder', projectId, newOrder)
  },

  // Label operations
  labels: {
    list: () => ipcRenderer.invoke('labels:list'),
    get: (id: string) => ipcRenderer.invoke('labels:get', id),
    create: (data: LabelCreate) => ipcRenderer.invoke('labels:create', data),
    update: (id: string, data: LabelUpdate) => ipcRenderer.invoke('labels:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('labels:delete', id)
  },

  // Section operations
  sections: {
    list: (projectId: string) => ipcRenderer.invoke('sections:list', projectId),
    create: (data: { name: string; projectId: string }) =>
      ipcRenderer.invoke('sections:create', data),
    update: (id: string, data: { name?: string; isCollapsed?: boolean }) =>
      ipcRenderer.invoke('sections:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('sections:delete', id),
    reorder: (sectionId: string, newOrder: number) =>
      ipcRenderer.invoke('sections:reorder', sectionId, newOrder)
  },

  // Filter operations
  filters: {
    list: () => ipcRenderer.invoke('filters:list'),
    create: (data: { name: string; query: string; color?: string }) =>
      ipcRenderer.invoke('filters:create', data),
    update: (id: string, data: { name?: string; query?: string; color?: string }) =>
      ipcRenderer.invoke('filters:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('filters:delete', id),
    evaluate: (query: string) => ipcRenderer.invoke('filters:evaluate', query)
  },

  // Date parsing
  parseDate: (text: string) => ipcRenderer.invoke('date:parse', text),

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value)
  },

  // Data export/import
  data: {
    exportJSON: () => ipcRenderer.invoke('data:exportJSON'),
    exportCSV: () => ipcRenderer.invoke('data:exportCSV'),
    importJSON: () => ipcRenderer.invoke('data:importJSON'),
    importCSV: () => ipcRenderer.invoke('data:importCSV')
  },

  // Undo/Redo operations
  undo: {
    canUndo: () => ipcRenderer.invoke('undo:canUndo'),
    canRedo: () => ipcRenderer.invoke('undo:canRedo'),
    undo: () => ipcRenderer.invoke('undo:undo'),
    redo: () => ipcRenderer.invoke('undo:redo'),
    clear: () => ipcRenderer.invoke('undo:clear')
  },

  // Event subscriptions
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}

export type ElectronAPI = typeof api
