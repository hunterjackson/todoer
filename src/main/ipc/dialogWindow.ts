import type { BrowserWindow } from 'electron'

export interface BrowserWindowResolver {
  getFocusedWindow: () => BrowserWindow | null
  getAllWindows: () => BrowserWindow[]
}

export function resolveDialogWindow(resolver: BrowserWindowResolver): BrowserWindow | null {
  const focusedWindow = resolver.getFocusedWindow()
  if (focusedWindow) {
    return focusedWindow
  }

  const windows = resolver.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}
