import type { FileRow } from '@shared/types'

// Matches a copy-suffixed filename stem like "part (1)" or "part (23)" - the pattern OS-level
// "keep both files" downloads produce when saving a second copy of the same name. Anchored to the
// very end of the stem (after stripping the extension) so it only matches a trailing counter, not
// legitimate parenthesized text elsewhere in a filename (e.g. "widget (blue).stl") or a suffix
// that isn't the last thing before the extension (e.g. "v2 (final) notes.stl").
const COPY_SUFFIX = /\s\(\d+\)$/

/** Strips a filename's extension (the substring from its last `.` onward), so the copy-suffix
 * check only ever looks at the stem. Filenames with no extension (or a leading dot, e.g.
 * ".gitignore"-style hidden files) pass through unchanged - `lastIndexOf` returns -1 or 0. */
function stripExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename
}

function hasCopySuffix(filename: string): boolean {
  return COPY_SUFFIX.test(stripExtension(filename))
}

/**
 * Picks which file to keep when collapsing a group of exact duplicates down to one, for the
 * duplicates view's "keep first, trash rest" action. Prefers the first file (in the given order)
 * whose filename has no "(1)"/"(2)"/"(n)" copy suffix - that's almost always the original download,
 * with the suffixed name(s) being an OS-level "keep both files" artifact of downloading it again.
 * Falls back to the first file in the given order if every file in the group is copy-suffixed.
 *
 * Deliberately doesn't re-sort `files` - it trusts whatever order the caller already has them in
 * (e.g. `listDuplicateFiles`'s alphabetical order) as the tie-breaker among equally-good candidates.
 */
export function pickFileToKeep(files: FileRow[]): FileRow {
  if (files.length === 0) throw new Error('pickFileToKeep requires at least one file')
  return files.find((file) => !hasCopySuffix(file.filename)) ?? files[0]
}
