import { Menu, app, BrowserWindow, MenuItemConstructorOptions, ipcMain } from 'electron'

const isMac = process.platform === 'darwin'

export function createAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export All Data (JSON)...',
              accelerator: 'CmdOrCtrl+Shift+E',
              click: async () => {
                const window = BrowserWindow.getFocusedWindow()
                if (window) {
                  window.webContents.send('menu:exportJSON')
                }
              }
            },
            {
              label: 'Export Tasks (CSV)...',
              click: async () => {
                const window = BrowserWindow.getFocusedWindow()
                if (window) {
                  window.webContents.send('menu:exportCSV')
                }
              }
            }
          ]
        },
        {
          label: 'Import',
          submenu: [
            {
              label: 'Import from JSON...',
              accelerator: 'CmdOrCtrl+Shift+I',
              click: async () => {
                const window = BrowserWindow.getFocusedWindow()
                if (window) {
                  window.webContents.send('menu:importJSON')
                }
              }
            },
            {
              label: 'Import Tasks from CSV...',
              click: async () => {
                const window = BrowserWindow.getFocusedWindow()
                if (window) {
                  window.webContents.send('menu:importCSV')
                }
              }
            }
          ]
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const }
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }])
      ]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
