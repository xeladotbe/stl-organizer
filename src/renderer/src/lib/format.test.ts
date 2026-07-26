import { describe, expect, it } from 'vitest'
import { formatSize } from './format'

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
