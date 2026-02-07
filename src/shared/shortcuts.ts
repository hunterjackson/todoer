export type ShortcutAction =
  // General
  | 'quickAdd'
  | 'search'
  | 'toggleSidebar'
  | 'help'
  | 'settings'
  | 'undo'
  | 'redo'
  // Navigation (chord: g + key)
  | 'goToday'
  | 'goInbox'
  | 'goUpcoming'
  | 'goCalendar'
  | 'navBack'
  | 'navForward'
  // Task list
  | 'taskMoveDown'
  | 'taskMoveUp'
  | 'taskComplete'
  | 'taskEdit'
  | 'taskDelete'
  | 'taskPriority1'
  | 'taskPriority2'
  | 'taskPriority3'
  | 'taskPriority4'
  | 'taskCollapse'
  | 'taskExpand'
  | 'taskIndent'
  | 'taskOutdent'
  | 'taskAddSubtask'
  | 'taskClearFocus'

export type ShortcutCategory = 'General' | 'Navigation' | 'Task List'

export interface ShortcutBinding {
  key: string // The key value (e.g. 'q', '/', 'ArrowLeft', 'z')
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  chord?: string // If set, the previous key must have been this (e.g. 'g' for g+t chord)
}

export interface ShortcutDefinition {
  action: ShortcutAction
  label: string
  category: ShortcutCategory
  binding: ShortcutBinding
  requiresNoInput?: boolean // If true, shortcut only fires when no input/textarea is focused
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // General
  { action: 'quickAdd', label: 'Quick add task', category: 'General', binding: { key: 'q' }, requiresNoInput: true },
  { action: 'search', label: 'Search', category: 'General', binding: { key: '/' }, requiresNoInput: true },
  { action: 'toggleSidebar', label: 'Toggle sidebar', category: 'General', binding: { key: 'm' }, requiresNoInput: true },
  { action: 'help', label: 'Show keyboard shortcuts', category: 'General', binding: { key: '?' }, requiresNoInput: true },
  { action: 'settings', label: 'Open Settings', category: 'General', binding: { key: ',', ctrl: true } },
  { action: 'undo', label: 'Undo', category: 'General', binding: { key: 'z', ctrl: true } },
  { action: 'redo', label: 'Redo', category: 'General', binding: { key: 'z', ctrl: true, shift: true } },

  // Navigation
  { action: 'goToday', label: 'Go to Today', category: 'Navigation', binding: { key: 't', chord: 'g' }, requiresNoInput: true },
  { action: 'goInbox', label: 'Go to Inbox', category: 'Navigation', binding: { key: 'i', chord: 'g' }, requiresNoInput: true },
  { action: 'goUpcoming', label: 'Go to Upcoming', category: 'Navigation', binding: { key: 'u', chord: 'g' }, requiresNoInput: true },
  { action: 'goCalendar', label: 'Go to Calendar', category: 'Navigation', binding: { key: 'c', chord: 'g' }, requiresNoInput: true },
  { action: 'navBack', label: 'Navigate back', category: 'Navigation', binding: { key: 'ArrowLeft', alt: true } },
  { action: 'navForward', label: 'Navigate forward', category: 'Navigation', binding: { key: 'ArrowRight', alt: true } },

  // Task List
  { action: 'taskMoveDown', label: 'Move focus down', category: 'Task List', binding: { key: 'j' }, requiresNoInput: true },
  { action: 'taskMoveUp', label: 'Move focus up', category: 'Task List', binding: { key: 'k' }, requiresNoInput: true },
  { action: 'taskComplete', label: 'Complete/uncomplete task', category: 'Task List', binding: { key: 'e' }, requiresNoInput: true },
  { action: 'taskEdit', label: 'Edit focused task', category: 'Task List', binding: { key: 'Enter' }, requiresNoInput: true },
  { action: 'taskDelete', label: 'Delete focused task', category: 'Task List', binding: { key: 'Backspace', ctrl: true } },
  { action: 'taskPriority1', label: 'Set priority 1', category: 'Task List', binding: { key: '1' }, requiresNoInput: true },
  { action: 'taskPriority2', label: 'Set priority 2', category: 'Task List', binding: { key: '2' }, requiresNoInput: true },
  { action: 'taskPriority3', label: 'Set priority 3', category: 'Task List', binding: { key: '3' }, requiresNoInput: true },
  { action: 'taskPriority4', label: 'Set priority 4', category: 'Task List', binding: { key: '4' }, requiresNoInput: true },
  { action: 'taskCollapse', label: 'Collapse subtasks', category: 'Task List', binding: { key: 'h' }, requiresNoInput: true },
  { action: 'taskExpand', label: 'Expand subtasks', category: 'Task List', binding: { key: 'l' }, requiresNoInput: true },
  { action: 'taskIndent', label: 'Indent task', category: 'Task List', binding: { key: 'Tab' }, requiresNoInput: true },
  { action: 'taskOutdent', label: 'Outdent task', category: 'Task List', binding: { key: 'Tab', shift: true }, requiresNoInput: true },
  { action: 'taskAddSubtask', label: 'Add subtask', category: 'Task List', binding: { key: 's' }, requiresNoInput: true },
  { action: 'taskClearFocus', label: 'Clear focus', category: 'Task List', binding: { key: 'Escape' }, requiresNoInput: true },
]

/**
 * Check if a KeyboardEvent matches a ShortcutBinding.
 * For chord shortcuts, `lastKey` is the previously pressed key.
 */
export function matchesShortcut(
  e: KeyboardEvent,
  binding: ShortcutBinding,
  lastKey?: string
): boolean {
  // Check chord requirement
  if (binding.chord && lastKey !== binding.chord) {
    return false
  }

  // Check the key - case-insensitive for letter keys
  const eventKey = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key
  if (eventKey !== bindingKey) {
    return false
  }

  // Check modifiers - use ctrlKey OR metaKey for the `ctrl` flag (cross-platform)
  const wantsCtrl = binding.ctrl ?? false
  const hasCtrlOrMeta = e.ctrlKey || e.metaKey
  if (wantsCtrl !== hasCtrlOrMeta) {
    return false
  }

  const wantsShift = binding.shift ?? false
  // For keys like '?' that require Shift to type, the event may have shiftKey=true
  // but the binding shouldn't require shift: true since the key character implies it.
  // Only apply this exception when the binding key IS the shifted character (e.g., '?', '!'),
  // not when the binding key is the unshifted character (e.g., '/') and Shift happens to be held.
  const SHIFTED_CHARS = new Set('?!@#$%^&*()_+{}|:"<>~')
  const isShiftedCharacter = SHIFTED_CHARS.has(binding.key) && e.shiftKey && !wantsShift
  if (!isShiftedCharacter && wantsShift !== e.shiftKey) {
    return false
  }

  const wantsAlt = binding.alt ?? false
  if (wantsAlt !== e.altKey) {
    return false
  }

  return true
}

/**
 * Convert a ShortcutBinding into display strings for rendering key badges.
 * Returns an array of key names (e.g. ['Ctrl', 'Z'] or ['G', 'then', 'T']).
 */
export function parseShortcutDisplay(binding: ShortcutBinding): string[] {
  const parts: string[] = []

  if (binding.chord) {
    parts.push(binding.chord.toUpperCase())
    parts.push('then')
  }

  const modifiers: string[] = []
  if (binding.ctrl) {
    // Show Cmd on Mac, Ctrl on others
    const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')
    modifiers.push(isMac ? 'Cmd' : 'Ctrl')
  }
  if (binding.alt) modifiers.push('Alt')
  if (binding.shift) modifiers.push('Shift')

  // Format the key display name
  let keyDisplay = binding.key
  switch (binding.key) {
    case 'ArrowLeft': keyDisplay = 'Left'; break
    case 'ArrowRight': keyDisplay = 'Right'; break
    case 'ArrowUp': keyDisplay = 'Up'; break
    case 'ArrowDown': keyDisplay = 'Down'; break
    case 'Backspace': keyDisplay = 'Backspace'; break
    case 'Delete': keyDisplay = 'Delete'; break
    case 'Enter': keyDisplay = 'Enter'; break
    case 'Escape': keyDisplay = 'Esc'; break
    case 'Tab': keyDisplay = 'Tab'; break
    case ' ': keyDisplay = 'Space'; break
    case ',': keyDisplay = ','; break
    case '/': keyDisplay = '/'; break
    case '?': keyDisplay = '?'; break
    default:
      if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase()
  }

  if (modifiers.length > 0) {
    parts.push(modifiers.join('+') + '+' + keyDisplay)
  } else {
    parts.push(keyDisplay)
  }

  return parts
}

/**
 * Merge user overrides with defaults. Returns a new array of ShortcutDefinitions
 * with the user's bindings applied.
 */
export function mergeShortcuts(
  defaults: ShortcutDefinition[],
  overrides: Record<string, ShortcutBinding>
): ShortcutDefinition[] {
  return defaults.map(def => {
    const override = overrides[def.action]
    if (override) {
      return { ...def, binding: override }
    }
    return def
  })
}

/**
 * Detect conflicts: two different actions that have the same binding.
 * Returns pairs of conflicting action names.
 */
export function detectConflicts(
  shortcuts: ShortcutDefinition[]
): Array<[ShortcutAction, ShortcutAction]> {
  const conflicts: Array<[ShortcutAction, ShortcutAction]> = []

  for (let i = 0; i < shortcuts.length; i++) {
    for (let j = i + 1; j < shortcuts.length; j++) {
      const a = shortcuts[i]
      const b = shortcuts[j]
      if (bindingsEqual(a.binding, b.binding)) {
        conflicts.push([a.action, b.action])
      }
    }
  }

  return conflicts
}

function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    (a.ctrl ?? false) === (b.ctrl ?? false) &&
    (a.shift ?? false) === (b.shift ?? false) &&
    (a.alt ?? false) === (b.alt ?? false) &&
    (a.meta ?? false) === (b.meta ?? false) &&
    (a.chord ?? '') === (b.chord ?? '')
  )
}

/**
 * Validate that a parsed shortcuts object has valid structure.
 */
export function validateShortcutsJSON(value: string): Record<string, ShortcutBinding> {
  const parsed = JSON.parse(value)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Keyboard shortcuts must be a JSON object')
  }

  const validActions = new Set<string>(DEFAULT_SHORTCUTS.map(s => s.action))
  const result: Record<string, ShortcutBinding> = {}

  for (const [action, binding] of Object.entries(parsed)) {
    if (!validActions.has(action)) {
      throw new Error(`Invalid shortcut action: ${action}`)
    }
    if (typeof binding !== 'object' || binding === null || Array.isArray(binding)) {
      throw new Error(`Invalid binding for action ${action}`)
    }
    const b = binding as Record<string, unknown>
    if (typeof b.key !== 'string' || b.key.length === 0) {
      throw new Error(`Missing or invalid key for action ${action}`)
    }
    result[action] = {
      key: b.key,
      ...(typeof b.ctrl === 'boolean' && { ctrl: b.ctrl }),
      ...(typeof b.shift === 'boolean' && { shift: b.shift }),
      ...(typeof b.alt === 'boolean' && { alt: b.alt }),
      ...(typeof b.meta === 'boolean' && { meta: b.meta }),
      ...(typeof b.chord === 'string' && { chord: b.chord }),
    }
  }

  return result
}
