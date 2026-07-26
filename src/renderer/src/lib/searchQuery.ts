export interface ParsedSearchQuery {
  textTokens: string[]
  tagTokens: string[]
  categoryTokens: string[]
  typeTokens: string[]
}

/** Splits a search query into plain filename/group-name tokens, `tag:name`, `category:name` and
 * `type:virtual|stl|3mf|obj` tokens. */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const textTokens: string[] = []
  const tagTokens: string[] = []
  const categoryTokens: string[] = []
  const typeTokens: string[] = []
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const tagMatch = /^tag:(.+)$/i.exec(token)
    const categoryMatch = /^category:(.+)$/i.exec(token)
    const typeMatch = /^type:(.+)$/i.exec(token)
    if (tagMatch) tagTokens.push(tagMatch[1].toLowerCase())
    else if (categoryMatch) categoryTokens.push(categoryMatch[1].toLowerCase())
    else if (typeMatch) typeTokens.push(typeMatch[1].toLowerCase())
    else textTokens.push(token.toLowerCase())
  }
  return { textTokens, tagTokens, categoryTokens, typeTokens }
}
