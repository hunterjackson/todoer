import { describe, it, expect } from 'vitest'
import { validateSettingEntry } from '@main/services/settingsValidation'

describe('settingsValidation', () => {
  it('accepts valid settings keys and values', () => {
    expect(validateSettingEntry('confirmDelete', 'true')).toEqual({
      key: 'confirmDelete',
      value: 'true'
    })
    expect(validateSettingEntry('timeFormat', '24h')).toEqual({
      key: 'timeFormat',
      value: '24h'
    })
    expect(validateSettingEntry('quietHoursStart', '22')).toEqual({
      key: 'quietHoursStart',
      value: '22'
    })
  })

  it('rejects unknown settings keys', () => {
    expect(() => validateSettingEntry('theme', 'dark')).toThrow(/invalid setting key/i)
  })

  it('rejects invalid boolean values', () => {
    expect(() => validateSettingEntry('confirmDelete', 'yes')).toThrow(/invalid value/i)
  })

  it('rejects invalid enum values', () => {
    expect(() => validateSettingEntry('timeFormat', 'ampm')).toThrow(/invalid value/i)
    expect(() => validateSettingEntry('dateFormat', 'dd-mm-yy')).toThrow(/invalid value/i)
  })

  it('rejects out-of-range numeric values', () => {
    expect(() => validateSettingEntry('quietHoursStart', '24')).toThrow(/invalid value/i)
    expect(() => validateSettingEntry('dailyGoal', '0')).toThrow(/invalid value/i)
  })

  it('trims whitespace from values', () => {
    expect(validateSettingEntry('confirmDelete', '  true  ')).toEqual({
      key: 'confirmDelete',
      value: 'true'
    })
  })

  describe('validateSettingEntryForImport', () => {
    it('should validate imported settings using same rules as settings:set', () => {
      // Valid entries pass
      expect(validateSettingEntry('confirmDelete', 'false')).toEqual({
        key: 'confirmDelete',
        value: 'false'
      })
      expect(validateSettingEntry('dailyGoal', '10')).toEqual({
        key: 'dailyGoal',
        value: '10'
      })
    })

    it('should reject invalid keys during import', () => {
      expect(() => validateSettingEntry('hackerKey', 'badValue')).toThrow(/invalid setting key/i)
    })

    it('should reject invalid values during import', () => {
      expect(() => validateSettingEntry('timeFormat', 'invalid')).toThrow(/invalid value/i)
    })
  })
})
