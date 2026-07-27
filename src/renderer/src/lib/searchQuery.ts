import picomatch from 'picomatch';

export interface ParsedSearchQuery {
  textTokens: string[];
  tagTokens: string[];
  categoryTokens: string[];
  typeTokens: string[];
}

export type TextMatcher = (value: string) => boolean;

// Extglob/brace/globstar features are deliberately switched off - we only want `*`, `?` and a
// leading `!` (negate the whole pattern, e.g. `!*.obj`) to be meaningful.
const GLOB_OPTIONS = { nocase: true, dot: true, noext: true, nobrace: true, noglobstar: true };

/** A token needs picomatch rather than plain substring matching if it uses `*`/`?`, or negates
 * via a leading `!` (picomatch's own convention - `!` anywhere else in the pattern is already
 * treated as a literal character by picomatch itself, no special-casing needed here). */
function isGlobToken(token: string): boolean {
  return /[*?]/.test(token) || token.startsWith('!');
}

// Regex/glob metacharacters other than `*`/`?`/`!` that real filenames commonly contain literally
// (e.g. "part (2).stl", "v2.0_final.stl"). `noext`/`nobrace` above only disable picomatch's
// *prefixed* extglob/brace forms (`+(...)`, `{a,b}`) - a bare `(...)`/`{...}` in the pattern still
// gets compiled as a regex group/quantifier, so these must be escaped to literal characters
// ourselves before picomatch ever sees them. `!` is deliberately excluded - see isGlobToken.
const GLOB_LITERAL_CHARS = /[\\^$.|+()[\]{}@]/g;

function escapeGlobLiterals(token: string): string {
  return token.replace(GLOB_LITERAL_CHARS, '\\$&');
}

/** Builds a matcher for one parsed search token - a token using glob syntax (see `isGlobToken`)
 * is compiled once into a whole-name glob matcher (via picomatch), everything else falls back to
 * a plain substring match. Compiling per-token up front (rather than per file) keeps filtering a
 * large library cheap. */
export function createTextMatcher(token: string): TextMatcher {
  if (isGlobToken(token)) {
    const isMatch = picomatch(escapeGlobLiterals(token), GLOB_OPTIONS);
    return (value: string) => isMatch(value);
  }
  return (value: string) => value.includes(token);
}

/** Appends a `tag:name`/`category:name` token (e.g. from clicking a badge) to an existing search
 * query, rather than replacing whatever the user already typed - so clicking a second badge
 * narrows the results further instead of discarding the first filter. A no-op (returns the
 * trimmed query unchanged) if that exact token is already present, case-insensitively, so
 * repeated clicks don't pile up duplicate tokens. */
export function insertSearchToken(query: string, token: string): string {
  const trimmed = query.trim();
  const existingTokens = trimmed.split(/\s+/).filter(Boolean);
  if (existingTokens.some((existing) => existing.toLowerCase() === token.toLowerCase())) {
    return trimmed;
  }
  return trimmed ? `${trimmed} ${token}` : token;
}

/** Splits a search query into plain filename/group-name tokens, `tag:name`, `category:name` and
 * `type:virtual|stl|3mf|obj` tokens. */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const textTokens: string[] = [];
  const tagTokens: string[] = [];
  const categoryTokens: string[] = [];
  const typeTokens: string[] = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const tagMatch = /^tag:(.+)$/i.exec(token);
    const categoryMatch = /^category:(.+)$/i.exec(token);
    const typeMatch = /^type:(.+)$/i.exec(token);
    if (tagMatch) tagTokens.push(tagMatch[1].toLowerCase());
    else if (categoryMatch) categoryTokens.push(categoryMatch[1].toLowerCase());
    else if (typeMatch) typeTokens.push(typeMatch[1].toLowerCase());
    else textTokens.push(token.toLowerCase());
  }
  return { textTokens, tagTokens, categoryTokens, typeTokens };
}
