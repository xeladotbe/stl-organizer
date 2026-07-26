import { describe, expect, it } from 'vitest'
import { formatSize, formatDateTime } from './format'

describe('formatSize', () => {
  it('formats sub-KB sizes in bytes', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(512)).toBe('512 B')
  })

  it('formats KB/MB/GB with one decimal', () => {
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
    expect(formatSize(1024 * 1024 * 1024 * 3)).toBe('3.0 GB')
  })

  it('does not go past GB', () => {
    expect(formatSize(1024 * 1024 * 1024 * 1024)).toBe('1024.0 GB')
  })
})

describe('formatDateTime', () => {
  // Constructed via the local-time Date constructor (not UTC) so these stay correct regardless
  // of the machine's timezone - formatDateTime reads local date/time fields the same way. An
  // explicit locale is passed so the assertions don't depend on the test runner's own locale.
  it("formats using the given locale's date/time conventions", () => {
    const ms = new Date(2026, 2, 5, 14, 7).getTime()
    expect(formatDateTime(ms, 'de-DE')).toBe('05.03.2026, 14:07')
    expect(formatDateTime(ms, 'en-US')).toBe('03/05/2026, 02:07 PM')
  })

  it('zero-pads single-digit day, month, hour and minute', () => {
    const ms = new Date(2026, 0, 1, 9, 5).getTime()
    expect(formatDateTime(ms, 'de-DE')).toBe('01.01.2026, 09:05')
  })

  it('uses 24-hour time for the de-DE locale', () => {
    const ms = new Date(2026, 5, 15, 23, 59).getTime()
    expect(formatDateTime(ms, 'de-DE')).toBe('15.06.2026, 23:59')
  })
})
