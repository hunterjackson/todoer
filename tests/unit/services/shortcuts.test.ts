import { describe, it, expect } from 'vitest'
import {
  matchesShortcut,
  parseShortcutDisplay,
  mergeShortcuts,
  detectConflicts,
  validateShortcutsJSON,
  DEFAULT_SHORTCUTS,
  type ShortcutBinding,
  type ShortcutDefinition
} from '../../../src/shared/shortcuts'

function makeKeyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides
  } as KeyboardEvent
}

describe('matchesShortcut', () => {
  it('matches simple single key', () => {
    const binding: ShortcutBinding = { key: 'q' }
    const event = makeKeyEvent({ key: 'q' })
    expect(matchesShortcut(event, binding)).toBe(true)
  })

  it('is case-insensitive for letter keys', () => {
    const binding: ShortcutBinding = { key: 'q' }
    const event = makeKeyEvent({ key: 'Q' })
    expect(matchesShortcut(event, binding)).toBe(true)
  })

  it('does not match wrong key', () => {
    const binding: ShortcutBinding = { key: 'q' }
    const event = makeKeyEvent({ key: 'w' })
    expect(matchesShortcut(event, binding)).toBe(false)
  })

  it('matches Ctrl modifier (ctrlKey)', () => {
    const binding: ShortcutBinding = { key: 'z', ctrl: true }
    const event = makeKeyEvent({ key: 'z', ctrlKey: true })
    expect(matchesShortcut(event, binding)).toBe(true)
  })

  it('matches Ctrl modifier (metaKey, for Mac)', () => {
    const binding: ShortcutBinding = { key: 'z', ctrl: true }
    const event = makeKeyEvent({ key: 'z', metaKey: true })
    expect(matchesShortcut(event, binding)).toBe(true)
  })

  it('rejects if modifier not pressed when required', () => {
    const binding: ShortcutBinding = { key: 'z', ctrl: true }
    const event = makeKeyEvent({ key: 'z' })
    expect(matchesShortcut(event, binding)).toBe(false)
  })

  it('rejects if extra modifier pressed when not required', () => {
    const binding: ShortcutBinding = { key: 'q' }
    const event = makeKeyEvent({ key: 'q', ctrlKey: true })
    expect(matchesShortcut(event, binding)).toBe(false)
  })

  it('matches Ctrl+Shift combination', () => {
    const binding: ShortcutBinding = { key: 'z', ctrl: true, shift: true }
    const event = makeKeyEvent({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(matchesShortcut(event, binding)).toBe(true)
  })

  it('matches Alt modifier', () => {
    const binding: ShortcutBinding = { key: 'ArrowLeft', alt: true }
    const event = makeKeyEvent({ key: 'ArrowLeft', altKey: true })
    expect(matchesShortcut(event, binding)).toBe(true)
  })

  it('matches chord when lastKey matches', () => {
    const binding: ShortcutBinding = { key: 't', chord: 'g' }
    const event = makeKeyEvent({ key: 't' })
    expect(matchesShortcut(event, binding, 'g')).toBe(true)
  })

  it('rejects chord when lastKey does not match', () => {
    const binding: ShortcutBinding = { key: 't', chord: 'g' }
    const event = makeKeyEvent({ key: 't' })
    expect(matchesShortcut(event, binding, 'x')).toBe(false)
  })

  it('rejects chord when lastKey is missing', () => {
    const binding: ShortcutBinding = { key: 't', chord: 'g' }
    const event = makeKeyEvent({ key: 't' })
    expect(matchesShortcut(event, binding)).toBe(false)
  })

  it('matches special keys exactly (Enter)', () => {
    const binding: ShortcutBinding = { key: 'Enter' }
    const event = makeKeyEvent({ key: 'Enter' })
    expect(matchesShortcut(event, binding)).toBe(true)
  })

  it('matches Backspace with Ctrl', () => {
    const binding: ShortcutBinding = { key: 'Backspace', ctrl: true }
    const event = makeKeyEvent({ key: 'Backspace', ctrlKey: true })
    expect(matchesShortcut(event, binding)).toBe(true)
  })
})

describe('parseShortcutDisplay', () => {
  it('displays simple key', () => {
    expect(parseShortcutDisplay({ key: 'q' })).toEqual(['Q'])
  })

  it('displays Ctrl+key', () => {
    const result = parseShortcutDisplay({ key: 'z', ctrl: true })
    // On Linux/test environment, should show Ctrl
    expect(result).toEqual(['Ctrl+Z'])
  })

  it('displays Ctrl+Shift+key', () => {
    const result = parseShortcutDisplay({ key: 'z', ctrl: true, shift: true })
    expect(result).toEqual(['Ctrl+Shift+Z'])
  })

  it('displays chord notation', () => {
    const result = parseShortcutDisplay({ key: 't', chord: 'g' })
    expect(result).toEqual(['G', 'then', 'T'])
  })

  it('displays Alt+ArrowLeft as Alt+Left', () => {
    const result = parseShortcutDisplay({ key: 'ArrowLeft', alt: true })
    expect(result).toEqual(['Alt+Left'])
  })

  it('displays Escape as Esc', () => {
    const result = parseShortcutDisplay({ key: 'Escape' })
    expect(result).toEqual(['Esc'])
  })

  it('displays ? correctly', () => {
    const result = parseShortcutDisplay({ key: '?' })
    expect(result).toEqual(['?'])
  })

  it('displays Tab', () => {
    const result = parseShortcutDisplay({ key: 'Tab' })
    expect(result).toEqual(['Tab'])
  })

  it('displays Shift+Tab', () => {
    const result = parseShortcutDisplay({ key: 'Tab', shift: true })
    expect(result).toEqual(['Shift+Tab'])
  })
})

describe('mergeShortcuts', () => {
  const testDefaults: ShortcutDefinition[] = [
    { action: 'quickAdd', label: 'Quick add', category: 'General', binding: { key: 'q' } },
    { action: 'search', label: 'Search', category: 'General', binding: { key: '/' } }
  ]

  it('returns defaults when no overrides', () => {
    const result = mergeShortcuts(testDefaults, {})
    expect(result).toEqual(testDefaults)
  })

  it('overrides specific binding', () => {
    const result = mergeShortcuts(testDefaults, {
      quickAdd: { key: 'a' }
    })
    expect(result[0].binding.key).toBe('a')
    expect(result[1].binding.key).toBe('/')
  })

  it('preserves label and category from defaults', () => {
    const result = mergeShortcuts(testDefaults, {
      quickAdd: { key: 'a' }
    })
    expect(result[0].label).toBe('Quick add')
    expect(result[0].category).toBe('General')
  })
})

describe('detectConflicts', () => {
  it('returns empty for no conflicts', () => {
    const shortcuts: ShortcutDefinition[] = [
      { action: 'quickAdd', label: 'Quick add', category: 'General', binding: { key: 'q' } },
      { action: 'search', label: 'Search', category: 'General', binding: { key: '/' } }
    ]
    expect(detectConflicts(shortcuts)).toEqual([])
  })

  it('detects conflicting bindings', () => {
    const shortcuts: ShortcutDefinition[] = [
      { action: 'quickAdd', label: 'Quick add', category: 'General', binding: { key: 'q' } },
      { action: 'search', label: 'Search', category: 'General', binding: { key: 'q' } }
    ]
    const conflicts = detectConflicts(shortcuts)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual(['quickAdd', 'search'])
  })

  it('does not flag different modifiers as conflict', () => {
    const shortcuts: ShortcutDefinition[] = [
      { action: 'quickAdd', label: 'Quick add', category: 'General', binding: { key: 'q' } },
      { action: 'search', label: 'Search', category: 'General', binding: { key: 'q', ctrl: true } }
    ]
    expect(detectConflicts(shortcuts)).toEqual([])
  })

  it('does not flag different chords as conflict', () => {
    const shortcuts: ShortcutDefinition[] = [
      { action: 'goToday', label: 'Today', category: 'Navigation', binding: { key: 't', chord: 'g' } },
      { action: 'goInbox', label: 'Inbox', category: 'Navigation', binding: { key: 'i', chord: 'g' } }
    ]
    expect(detectConflicts(shortcuts)).toEqual([])
  })
})

describe('validateShortcutsJSON', () => {
  it('accepts empty object', () => {
    const result = validateShortcutsJSON('{}')
    expect(result).toEqual({})
  })

  it('accepts valid override', () => {
    const result = validateShortcutsJSON('{"quickAdd":{"key":"a"}}')
    expect(result).toEqual({ quickAdd: { key: 'a' } })
  })

  it('accepts binding with modifiers', () => {
    const result = validateShortcutsJSON('{"undo":{"key":"z","ctrl":true,"shift":true}}')
    expect(result).toEqual({ undo: { key: 'z', ctrl: true, shift: true } })
  })

  it('rejects invalid action', () => {
    expect(() => validateShortcutsJSON('{"invalidAction":{"key":"a"}}')).toThrow('Invalid shortcut action')
  })

  it('rejects non-object', () => {
    expect(() => validateShortcutsJSON('"string"')).toThrow('must be a JSON object')
  })

  it('rejects array', () => {
    expect(() => validateShortcutsJSON('[]')).toThrow('must be a JSON object')
  })

  it('rejects binding without key', () => {
    expect(() => validateShortcutsJSON('{"quickAdd":{"ctrl":true}}')).toThrow('Missing or invalid key')
  })

  it('rejects binding with empty key', () => {
    expect(() => validateShortcutsJSON('{"quickAdd":{"key":""}}')).toThrow('Missing or invalid key')
  })

  it('strips unknown fields from binding', () => {
    const result = validateShortcutsJSON('{"quickAdd":{"key":"a","unknown":"value"}}')
    expect(result).toEqual({ quickAdd: { key: 'a' } })
  })
})

describe('DEFAULT_SHORTCUTS', () => {
  it('has unique actions', () => {
    const actions = DEFAULT_SHORTCUTS.map(s => s.action)
    expect(new Set(actions).size).toBe(actions.length)
  })

  it('has no conflicting default bindings', () => {
    const conflicts = detectConflicts(DEFAULT_SHORTCUTS)
    expect(conflicts).toEqual([])
  })

  it('covers all expected categories', () => {
    const categories = new Set(DEFAULT_SHORTCUTS.map(s => s.category))
    expect(categories.has('General')).toBe(true)
    expect(categories.has('Navigation')).toBe(true)
    expect(categories.has('Task List')).toBe(true)
  })
})
