import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc/handlers'
import { createAppMenu } from './menu'

let mainWindow: BrowserWindow | null = null

// Check for MCP mode
const isMcpMode = process.argv.includes('--mcp')

// Get is.dev equivalent
const isDev = !app.isPackaged

// Disable GPU acceleration to prevent GL errors on some systems
// This fixes: GetVSyncParametersIfAvailable() failed
app.disableHardwareAcceleration()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (isMcpMode) {
  // Run as MCP server only (no GUI)
  initDatabase().then(() => {
    import('./mcp/server').then(({ startMcpServer }) => {
      startMcpServer()
    })
  })
} else {
  // Normal Electron app
  app.whenReady().then(async () => {
    try {
      // Set app user model id for Windows
      app.setAppUserModelId('com.todoer.app')

      // Initialize database
      await initDatabase()

      // Register IPC handlers
      registerIpcHandlers()

      // Create application menu
      createAppMenu()

      createWindow()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
        }
      })
    } catch (error) {
      console.error('Failed to initialize app:', error)
    }
  }).catch((error) => {
    console.error('App ready failed:', error)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

export { mainWindow }
