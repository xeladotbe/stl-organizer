import { describe, expect, it } from 'vitest'
import { buildComboOptions } from './comboOptions'

const suggestions = [
  { id: 1, name: 'Bad' },
  { id: 2, name: 'Bracket' },
  { id: 3, name: 'Vase' }
]

describe('buildComboOptions', () => {
  it('returns all suggestions, no create option, when the query is blank', () => {
    expect(buildComboOptions(suggestions, '')).toEqual([
      { type: 'existing', id: 1, name: 'Bad' },
      { type: 'existing', id: 2, name: 'Bracket' },
      { type: 'existing', id: 3, name: 'Vase' }
    ])
  })

  it('filters suggestions by substring, case-insensitively', () => {
    expect(buildComboOptions(suggestions, 'ra')).toEqual([
      { type: 'existing', id: 2, name: 'Bracket' },
      { type: 'create', name: 'ra' }
    ])
  })

  it('appends a create option when the query has no exact match', () => {
    expect(buildComboOptions(suggestions, 'new tag')).toEqual([{ type: 'create', name: 'new tag' }])
  })

  it('does not append a create option when the query exactly matches an existing entry', () => {
    expect(buildComboOptions(suggestions, 'Vase')).toEqual([{ type: 'existing', id: 3, name: 'Vase' }])
    expect(buildComboOptions(suggestions, 'vase')).toEqual([{ type: 'existing', id: 3, name: 'Vase' }])
  })

  it('trims whitespace before matching', () => {
    expect(buildComboOptions(suggestions, '  vase  ')).toEqual([
      { type: 'existing', id: 3, name: 'Vase' }
    ])
  })

  it('offers to create even when a partial (non-exact) match exists', () => {
    expect(buildComboOptions(suggestions, 'brack')).toEqual([
      { type: 'existing', id: 2, name: 'Bracket' },
      { type: 'create', name: 'brack' }
    ])
  })
})
