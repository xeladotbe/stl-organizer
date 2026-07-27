import type { FileRow } from '@shared/types'

/**
 * Duplicates are never stored - `content_hash` is the only signal, and the store's
 * `duplicateIds` set only tells you *whether* a file is a duplicate, not *which* other files it
 * matches. Finding a file's siblings means scanning the full file list for a shared hash, which
 * this helper does so `DetailPane` doesn't need to inline the same matching logic.
 */
export function findDuplicateSiblings(files: FileRow[], file: FileRow): FileRow[] {
  if (!file.content_hash) return []
  return files.filter((f) => f.id !== file.id && f.content_hash === file.content_hash)
}
