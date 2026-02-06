import { beforeAll, afterAll, vi } from 'vitest'

// Set test environment - these are enforced at multiple levels for safety
// The goal is to make it IMPOSSIBLE to pollute the production database
process.env.NODE_ENV = 'test'
process.env.VITEST = 'true'
process.env.TODOER_TEST_MODE = 'true'
// Clear any custom data path to prevent accidental file-based DB usage
process.env.TODOER_DATA_PATH = ''

// Mock Electron modules for testing
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/todoer-test'),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn()
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
    webContents: {
      setWindowOpenHandler: vi.fn()
    }
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

// Cleanup after tests
afterAll(() => {
  vi.restoreAllMocks()
})
