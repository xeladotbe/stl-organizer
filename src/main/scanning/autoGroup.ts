import { dirname, basename } from 'path';
import type { FileRow } from '../../shared/types';
import { findFilesNearMtime } from '../db/repositories/filesRepo';
import { createGroup, addFilesToGroup } from '../db/repositories/modelGroupsRepo';

/**
 * Files whose mtimes land within this many ms of each other are considered "created together"
 * for auto-grouping purposes - see issue #32. Multi-part prints usually land on disk as several
 * files created within a couple of seconds of each other (unzipped, or downloaded as a batch);
 * 10s comfortably covers that while staying tight enough not to sweep up unrelated files.
 */
export const AUTO_GROUP_WINDOW_MS = 10_000;

/** The subset of a file's fields the auto-grouping decision actually needs - kept separate from
 *  FileRow so the decision logic (planAutoGroup) stays a pure function with no DB dependency,
 *  testable without touching better-sqlite3 or Electron at all. */
export interface AutoGroupCandidate {
  id: number;
  path: string;
  mtimeMs: number;
  groupId: number | null;
}

export type AutoGroupDecision =
  | { action: 'none' }
  | { action: 'create'; fileIds: number[] }
  | { action: 'join'; groupId: number; fileIds: number[] };

/**
 * Pure decision function: given one file and a set of *candidate* files that share its watched
 * folder (folder_id - callers pre-filter this much via SQL for performance; a watched folder can
 * be nested arbitrarily deep, so folder_id alone is not "same directory"), decide what
 * auto-grouping action, if any, applies.
 *
 * Deliberately conservative:
 * - A file that already belongs to a group is left alone - never re-grouped, never used to grow
 *   a *different* group. This respects manual grouping and makes the function idempotent (safe
 *   to call again for the same file, e.g. every time a watched folder is rescanned on startup).
 * - Only files in the exact same directory (dirname), within AUTO_GROUP_WINDOW_MS of this file's
 *   mtime, are considered siblings - not the whole watched folder tree, so bulk-extracting one
 *   subfolder doesn't sweep up unrelated files living in a sibling subfolder scanned around the
 *   same time.
 * - If those siblings already belong to more than one distinct existing group, that's ambiguous
 *   (which one would this file join?) - skipped rather than guessed.
 * - If they belong to exactly one existing group, this file joins it.
 * - If none of them belong to a group yet, a new group is created from this file plus every
 *   still-ungrouped sibling.
 */
export function planAutoGroup(
  file: AutoGroupCandidate,
  candidates: AutoGroupCandidate[]
): AutoGroupDecision {
  if (file.groupId != null) return { action: 'none' };

  const siblings = candidates.filter(
    (c) =>
      c.id !== file.id &&
      dirname(c.path) === dirname(file.path) &&
      Math.abs(c.mtimeMs - file.mtimeMs) <= AUTO_GROUP_WINDOW_MS
  );
  if (siblings.length === 0) return { action: 'none' };

  const existingGroupIds = [
    ...new Set(siblings.filter((s) => s.groupId != null).map((s) => s.groupId as number))
  ];
  if (existingGroupIds.length > 1) return { action: 'none' };

  if (existingGroupIds.length === 1) {
    return { action: 'join', groupId: existingGroupIds[0], fileIds: [file.id] };
  }

  const ungrouped = siblings.filter((s) => s.groupId == null);
  return { action: 'create', fileIds: [file.id, ...ungrouped.map((s) => s.id)] };
}

/** Default name for an auto-created group, since this flow has no user-provided name: the shared
 *  parent directory's name (the same directory that scoped the "siblings" match), falling back
 *  to a generic label on the rare chance that's empty (e.g. a file living at a drive root). */
export function deriveAutoGroupName(path: string): string {
  const folderName = basename(dirname(path));
  return folderName || 'Auto-grouped files';
}

export function toAutoGroupCandidate(file: FileRow): AutoGroupCandidate {
  return { id: file.id, path: file.path, mtimeMs: file.mtime_ms, groupId: file.group_id };
}

/**
 * Called after a file is scanned/upserted (see watcherManager.ts). Looks up other files sharing
 * this file's watched folder, applies planAutoGroup, and creates/grows a model group in the DB
 * if warranted. Safe to call unconditionally and repeatedly for the same file (e.g. every time a
 * watched folder is rescanned on app startup) since planAutoGroup no-ops once a file already has
 * a group_id.
 */
export function maybeAutoGroupFile(file: FileRow): void {
  const nearby = findFilesNearMtime(file.folder_id, file.mtime_ms, AUTO_GROUP_WINDOW_MS, file.id);
  const decision = planAutoGroup(toAutoGroupCandidate(file), nearby.map(toAutoGroupCandidate));

  if (decision.action === 'create') {
    createGroup(deriveAutoGroupName(file.path), decision.fileIds);
  } else if (decision.action === 'join') {
    addFilesToGroup(decision.groupId, decision.fileIds);
  }
}
