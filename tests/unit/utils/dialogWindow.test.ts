import { describe, it, expect } from 'vitest'
import { resolveDialogWindow, type BrowserWindowResolver } from '@main/ipc/dialogWindow'

describe('resolveDialogWindow', () => {
  it('returns the focused window when one exists', () => {
    const focused = { id: 'focused' } as unknown
    const first = { id: 'first' } as unknown

    const resolver: BrowserWindowResolver = {
      getFocusedWindow: () => focused as never,
      getAllWindows: () => [first as never]
    }

    expect(resolveDialogWindow(resolver)).toBe(focused)
  })

  it('falls back to first open window when no focused window exists', () => {
    const first = { id: 'first' } as unknown
    const resolver: BrowserWindowResolver = {
      getFocusedWindow: () => null,
      getAllWindows: () => [first as never]
    }

    expect(resolveDialogWindow(resolver)).toBe(first)
  })

  it('returns null when no windows are available', () => {
    const resolver: BrowserWindowResolver = {
      getFocusedWindow: () => null,
      getAllWindows: () => []
    }

    expect(resolveDialogWindow(resolver)).toBeNull()
  })
})
