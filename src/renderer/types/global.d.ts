/// <reference path="../../preload/index.d.ts" />

// Re-export for renderer files
import type { ElectronAPI } from '../../preload/index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
