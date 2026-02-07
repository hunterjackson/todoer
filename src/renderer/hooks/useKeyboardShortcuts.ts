import { useMemo } from 'react'
import { useSettings } from './useSettings'
import {
  DEFAULT_SHORTCUTS,
  mergeShortcuts,
  matchesShortcut,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutDefinition
} from '@shared/shortcuts'

export function useKeyboardShortcuts() {
  const { settings } = useSettings()

  const shortcuts = useMemo(
    () => mergeShortcuts(DEFAULT_SHORTCUTS, settings.keyboardShortcuts),
    [settings.keyboardShortcuts]
  )

  const shortcutMap = useMemo(() => {
    const map = new Map<ShortcutAction, ShortcutDefinition>()
    for (const s of shortcuts) {
      map.set(s.action, s)
    }
    return map
  }, [shortcuts])

  function getShortcuts(): ShortcutDefinition[] {
    return shortcuts
  }

  function getBinding(action: ShortcutAction): ShortcutBinding {
    return shortcutMap.get(action)?.binding ?? DEFAULT_SHORTCUTS.find(s => s.action === action)!.binding
  }

  function matchShortcut(e: KeyboardEvent, action: ShortcutAction, lastKey?: string): boolean {
    const def = shortcutMap.get(action)
    if (!def) return false
    return matchesShortcut(e, def.binding, lastKey)
  }

  return { getShortcuts, getBinding, matchShortcut }
}
