import { describe, expect, it } from 'vitest'
import { parseSearchQuery } from './searchQuery'

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
    expect(parseSearchQuery('type:stl type:3mf')).toEqual({
      textTokens: [],
      tagTokens: [],
      categoryTokens: [],
      typeTokens: ['stl', '3mf']
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
