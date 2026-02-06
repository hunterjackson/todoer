import { describe, it, expect } from 'vitest'
import { formatDateByPreference, formatDateHeader, formatDateGroupLabel, formatTime } from '@shared/utils/formatDate'

describe('formatDateByPreference', () => {
  const date = new Date(2026, 1, 6) // Feb 6, 2026

  it('formats mdy (default)', () => {
    expect(formatDateByPreference(date, 'mdy')).toBe('Feb 6, 2026')
  })

  it('formats dmy', () => {
    expect(formatDateByPreference(date, 'dmy')).toBe('6 Feb 2026')
  })

  it('formats ymd', () => {
    expect(formatDateByPreference(date, 'ymd')).toBe('2026 Feb 6')
  })
})

describe('formatDateHeader', () => {
  // Feb 6, 2026 is a Friday
  const date = new Date(2026, 1, 6)

  it('includes weekday for mdy format', () => {
    expect(formatDateHeader(date, 'mdy')).toBe('Friday, Feb 6')
  })

  it('includes weekday for dmy format', () => {
    expect(formatDateHeader(date, 'dmy')).toBe('Friday, 6 Feb')
  })

  it('includes weekday for ymd format', () => {
    expect(formatDateHeader(date, 'ymd')).toBe('Friday, Feb 6')
  })
})

describe('formatDateGroupLabel', () => {
  // Feb 6, 2026 is a Friday
  const date = new Date(2026, 1, 6)

  it('uses short weekday for mdy format', () => {
    expect(formatDateGroupLabel(date, 'mdy')).toBe('Fri, Feb 6')
  })

  it('uses short weekday for dmy format', () => {
    expect(formatDateGroupLabel(date, 'dmy')).toBe('Fri, 6 Feb')
  })

  it('uses short weekday for ymd format', () => {
    expect(formatDateGroupLabel(date, 'ymd')).toBe('Fri, Feb 6')
  })
})

describe('formatTime', () => {
  it('formats 12h AM', () => {
    const date = new Date(2026, 0, 1, 9, 5)
    expect(formatTime(date, '12h')).toBe('9:05 AM')
  })

  it('formats 12h PM', () => {
    const date = new Date(2026, 0, 1, 14, 30)
    expect(formatTime(date, '12h')).toBe('2:30 PM')
  })

  it('formats 12h midnight as 12:00 AM', () => {
    const date = new Date(2026, 0, 1, 0, 0)
    expect(formatTime(date, '12h')).toBe('12:00 AM')
  })

  it('formats 12h noon as 12:00 PM', () => {
    const date = new Date(2026, 0, 1, 12, 0)
    expect(formatTime(date, '12h')).toBe('12:00 PM')
  })

  it('formats 24h', () => {
    const date = new Date(2026, 0, 1, 14, 5)
    expect(formatTime(date, '24h')).toBe('14:05')
  })

  it('formats 24h midnight', () => {
    const date = new Date(2026, 0, 1, 0, 0)
    expect(formatTime(date, '24h')).toBe('00:00')
  })
})
