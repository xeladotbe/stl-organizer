import { describe, expect, it } from 'vitest'
import { isModelFile } from './scanner'

describe('isModelFile', () => {
  it('accepts .stl, .3mf and .obj, case-insensitively', () => {
    expect(isModelFile('C:/models/part.stl')).toBe(true)
    expect(isModelFile('C:/models/PART.STL')).toBe(true)
    expect(isModelFile('C:/models/model.3mf')).toBe(true)
    expect(isModelFile('C:/models/MODEL.3MF')).toBe(true)
    expect(isModelFile('C:/models/part.obj')).toBe(true)
    expect(isModelFile('C:/models/PART.OBJ')).toBe(true)
  })

  it('rejects other extensions', () => {
    expect(isModelFile('C:/models/readme.txt')).toBe(false)
    expect(isModelFile('C:/models/archive.zip')).toBe(false)
    expect(isModelFile('C:/models/no-extension')).toBe(false)
  })
})
