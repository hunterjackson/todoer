import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test the keyboard shortcut parsing and handling logic
describe('Keyboard Shortcuts', () => {
  describe('Shortcut parsing', () => {
    it('should recognize single key shortcuts', () => {
      const shortcuts = [
        { key: 'q', action: 'quickAdd' },
        { key: '/', action: 'search' },
        { key: 'e', action: 'complete' },
        { key: 'm', action: 'toggleSidebar' }
      ]

      shortcuts.forEach(({ key, action }) => {
        expect(parseShortcut(key)).toEqual({ key, modifiers: [] })
      })
    })

    it('should recognize modifier key shortcuts', () => {
      expect(parseShortcut('ctrl+z')).toEqual({ key: 'z', modifiers: ['ctrl'] })
      expect(parseShortcut('cmd+shift+z')).toEqual({ key: 'z', modifiers: ['cmd', 'shift'] })
      expect(parseShortcut('alt+enter')).toEqual({ key: 'enter', modifiers: ['alt'] })
    })

    it('should recognize chord shortcuts (g then t)', () => {
      expect(parseChord('g t')).toEqual([
        { key: 'g', modifiers: [] },
        { key: 't', modifiers: [] }
      ])
      expect(parseChord('g i')).toEqual([
        { key: 'g', modifiers: [] },
        { key: 'i', modifiers: [] }
      ])
    })
  })

  describe('Shortcut matching', () => {
    it('should match simple key events', () => {
      const event = createKeyEvent('q')
      expect(matchesShortcut(event, { key: 'q', modifiers: [] })).toBe(true)
      expect(matchesShortcut(event, { key: 'w', modifiers: [] })).toBe(false)
    })

    it('should match modifier key events', () => {
      const ctrlZ = createKeyEvent('z', { ctrl: true })
      expect(matchesShortcut(ctrlZ, { key: 'z', modifiers: ['ctrl'] })).toBe(true)
      expect(matchesShortcut(ctrlZ, { key: 'z', modifiers: [] })).toBe(false)
    })

    it('should not match when in input field', () => {
      const event = createKeyEvent('q')
      // Simulate being in an input field
      expect(shouldIgnoreShortcut(event, 'INPUT')).toBe(true)
      expect(shouldIgnoreShortcut(event, 'TEXTAREA')).toBe(true)
      expect(shouldIgnoreShortcut(event, 'DIV')).toBe(false)
    })
  })

  describe('Priority shortcuts (1-4)', () => {
    it('should recognize priority keys', () => {
      for (let i = 1; i <= 4; i++) {
        expect(isPriorityKey(String(i))).toBe(true)
        expect(getPriorityFromKey(String(i))).toBe(i)
      }
      expect(isPriorityKey('5')).toBe(false)
      expect(isPriorityKey('a')).toBe(false)
    })
  })
})

// Helper functions that will be implemented
function parseShortcut(shortcut: string): { key: string; modifiers: string[] } {
  const parts = shortcut.toLowerCase().split('+')
  const key = parts.pop() || ''
  return { key, modifiers: parts }
}

function parseChord(chord: string): Array<{ key: string; modifiers: string[] }> {
  return chord.split(' ').map(parseShortcut)
}

function createKeyEvent(key: string, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: modifiers.ctrl || false,
    shiftKey: modifiers.shift || false,
    altKey: modifiers.alt || false,
    metaKey: modifiers.meta || false
  } as KeyboardEvent
}

function matchesShortcut(event: KeyboardEvent, shortcut: { key: string; modifiers: string[] }): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false

  const hasCtrl = shortcut.modifiers.includes('ctrl')
  const hasShift = shortcut.modifiers.includes('shift')
  const hasAlt = shortcut.modifiers.includes('alt')
  const hasMeta = shortcut.modifiers.includes('cmd') || shortcut.modifiers.includes('meta')

  if (hasCtrl !== event.ctrlKey) return false
  if (hasShift !== event.shiftKey) return false
  if (hasAlt !== event.altKey) return false
  if (hasMeta !== event.metaKey) return false

  return true
}

function shouldIgnoreShortcut(_event: KeyboardEvent, tagName: string): boolean {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)
}

function isPriorityKey(key: string): boolean {
  return ['1', '2', '3', '4'].includes(key)
}

function getPriorityFromKey(key: string): number {
  return parseInt(key, 10)
}
