import { describe, expect, it } from 'vitest'
import { parseSearchQuery, createTextMatcher, insertSearchToken } from './searchQuery'

describe('parseSearchQuery', () => {
  it('treats plain words as text tokens', () => {
    expect(parseSearchQuery('spacer bracket')).toEqual({
      textTokens: ['spacer', 'bracket'],
      tagTokens: [],
      categoryTokens: [],
      typeTokens: []
    })
  })

  it('splits out tag:, category: and type: tokens, lowercased', () => {
    expect(parseSearchQuery('spacer tag:Bad category:Vases type:STL')).toEqual({
      textTokens: ['spacer'],
      tagTokens: ['bad'],
      categoryTokens: ['vases'],
      typeTokens: ['stl']
    })
  })

  it('supports type:virtual and type:3mf', () => {
    expect(parseSearchQuery('type:virtual')).toEqual({
      textTokens: [],
      tagTokens: [],
      categoryTokens: [],
      typeTokens: ['virtual']
    })
    expect(parseSearchQuery('type:3mf')).toEqual({
      textTokens: [],
      tagTokens: [],
      categoryTokens: [],
      typeTokens: ['3mf']
    })
  })

  it('collects multiple type: tokens', () => {
    expect(parseSearchQuery('type:stl type:3mf type:obj')).toEqual({
      textTokens: [],
      tagTokens: [],
      categoryTokens: [],
      typeTokens: ['stl', '3mf', 'obj']
    })
  })

  it('ignores extra whitespace and empty queries', () => {
    expect(parseSearchQuery('   ')).toEqual({
      textTokens: [],
      tagTokens: [],
      categoryTokens: [],
      typeTokens: []
    })
  })
})

describe('insertSearchToken', () => {
  it('appends the token to an empty query', () => {
    expect(insertSearchToken('', 'tag:Bracket')).toBe('tag:Bracket')
  })

  it('appends the token after whatever the user already typed', () => {
    expect(insertSearchToken('spacer', 'tag:Bracket')).toBe('spacer tag:Bracket')
  })

  it('combines multiple different tokens (AND semantics via parseSearchQuery)', () => {
    const withTag = insertSearchToken('', 'tag:Bracket')
    const withBoth = insertSearchToken(withTag, 'category:Vases')
    expect(withBoth).toBe('tag:Bracket category:Vases')
  })

  it('is a no-op when the exact token is already present, case-insensitively', () => {
    expect(insertSearchToken('tag:Bracket', 'tag:bracket')).toBe('tag:Bracket')
  })

  it('trims surrounding whitespace on the existing query', () => {
    expect(insertSearchToken('  spacer  ', 'tag:Bracket')).toBe('spacer tag:Bracket')
  })
})

describe('createTextMatcher', () => {
  it('falls back to plain substring matching when there are no wildcards', () => {
    const matches = createTextMatcher('spacer')
    expect(matches('my_spacer_v2.stl')).toBe(true)
    expect(matches('bracket.stl')).toBe(false)
  })

  it('matches a * glob against the whole filename', () => {
    expect(createTextMatcher('spacer*.stl')('spacer_v2.stl')).toBe(true)
    expect(createTextMatcher('spacer*.stl')('my_spacer_v2.stl')).toBe(false)
    expect(createTextMatcher('*spacer*')('my_spacer_v2.stl')).toBe(true)
  })

  it('matches a ? glob against exactly one character', () => {
    const matches = createTextMatcher('spacer?.stl')
    expect(matches('spacer1.stl')).toBe(true)
    expect(matches('spacer12.stl')).toBe(false)
    expect(matches('spacer.stl')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(createTextMatcher('spacer*')('SPACER_V2.STL')).toBe(true)
  })

  it('treats glob-adjacent regex characters literally', () => {
    const matches = createTextMatcher('v2.0*')
    expect(matches('v2.0_final.stl')).toBe(true)
    expect(matches('v2x0_final.stl')).toBe(false)
  })

  it('treats parentheses and other extglob-ish characters as literal', () => {
    const matches = createTextMatcher('part (2)*')
    expect(matches('part (2).stl')).toBe(true)
  })

  it('negates the whole pattern with a leading !', () => {
    const matches = createTextMatcher('!*.obj')
    expect(matches('part.obj')).toBe(false)
    expect(matches('part.stl')).toBe(true)
    expect(matches('part.3mf')).toBe(true)
  })

  it('negates an exact name with a leading ! and no other wildcards', () => {
    const matches = createTextMatcher('!part.stl')
    expect(matches('part.stl')).toBe(false)
    expect(matches('other.stl')).toBe(true)
  })

  it('treats a non-leading ! as a literal character', () => {
    const matches = createTextMatcher('final!*.stl')
    expect(matches('final!.stl')).toBe(true)
    expect(matches('part.stl')).toBe(false)
  })
})
