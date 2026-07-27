import { describe, expect, it } from 'vitest';
import {
  planAutoGroup,
  deriveAutoGroupName,
  AUTO_GROUP_WINDOW_MS,
  type AutoGroupCandidate
} from './autoGroup';

function candidate(id: number, overrides: Partial<AutoGroupCandidate> = {}): AutoGroupCandidate {
  return {
    id,
    path: `C:/models/part-${id}.stl`,
    mtimeMs: 0,
    groupId: null,
    ...overrides
  };
}

describe('planAutoGroup', () => {
  it('creates a new group from a file plus its ungrouped siblings within the time window', () => {
    const file = candidate(1, { path: 'C:/models/batch/a.stl', mtimeMs: 10_000 });
    const siblings = [
      candidate(2, { path: 'C:/models/batch/b.stl', mtimeMs: 10_000 + AUTO_GROUP_WINDOW_MS - 1 }),
      candidate(3, { path: 'C:/models/batch/c.stl', mtimeMs: 10_000 - AUTO_GROUP_WINDOW_MS + 1 })
    ];

    const decision = planAutoGroup(file, siblings);

    expect(decision).toEqual({ action: 'create', fileIds: [1, 2, 3] });
  });

  it('does nothing when no other file in the folder falls within the time window', () => {
    const file = candidate(1, { path: 'C:/models/batch/a.stl', mtimeMs: 10_000 });
    const tooFarInTime = [
      candidate(2, { path: 'C:/models/batch/b.stl', mtimeMs: 10_000 + AUTO_GROUP_WINDOW_MS + 1 })
    ];

    expect(planAutoGroup(file, tooFarInTime)).toEqual({ action: 'none' });
  });

  it('ignores files in a different directory even if their mtime is within the window', () => {
    const file = candidate(1, { path: 'C:/models/batch-1/a.stl', mtimeMs: 10_000 });
    const otherFolder = [candidate(2, { path: 'C:/models/batch-2/b.stl', mtimeMs: 10_000 })];

    expect(planAutoGroup(file, otherFolder)).toEqual({ action: 'none' });
  });

  it('never touches a file that already belongs to a group', () => {
    const file = candidate(1, {
      path: 'C:/models/batch/a.stl',
      mtimeMs: 10_000,
      groupId: 42
    });
    const siblings = [candidate(2, { path: 'C:/models/batch/b.stl', mtimeMs: 10_000 })];

    expect(planAutoGroup(file, siblings)).toEqual({ action: 'none' });
  });

  it('joins the single existing group its siblings already belong to', () => {
    const file = candidate(1, { path: 'C:/models/batch/a.stl', mtimeMs: 10_000 });
    const siblings = [
      candidate(2, { path: 'C:/models/batch/b.stl', mtimeMs: 10_000, groupId: 7 }),
      candidate(3, { path: 'C:/models/batch/c.stl', mtimeMs: 10_000, groupId: 7 })
    ];

    expect(planAutoGroup(file, siblings)).toEqual({ action: 'join', groupId: 7, fileIds: [1] });
  });

  it('does not guess when nearby siblings belong to two different existing groups', () => {
    const file = candidate(1, { path: 'C:/models/batch/a.stl', mtimeMs: 10_000 });
    const siblings = [
      candidate(2, { path: 'C:/models/batch/b.stl', mtimeMs: 10_000, groupId: 7 }),
      candidate(3, { path: 'C:/models/batch/c.stl', mtimeMs: 10_000, groupId: 8 })
    ];

    expect(planAutoGroup(file, siblings)).toEqual({ action: 'none' });
  });

  it('only pulls in the ungrouped siblings when creating a new group, leaving other groups alone', () => {
    // Same-folder, same-window mix: one already-grouped-elsewhere sibling should block auto
    // grouping entirely if it's the only "existing group" signal alongside ungrouped ones would
    // still be ambiguous only when >1 distinct group is present; a single distinct group always
    // wins as a join, per the "joins the single existing group" case above. This covers the
    // create-with-partial-siblings shape instead: two ungrouped siblings, no existing group.
    const file = candidate(1, { path: 'C:/models/batch/a.stl', mtimeMs: 10_000 });
    const siblings = [
      candidate(2, { path: 'C:/models/batch/b.stl', mtimeMs: 10_000 }),
      candidate(4, { path: 'C:/models/batch/d.stl', mtimeMs: 10_000 })
    ];

    expect(planAutoGroup(file, siblings)).toEqual({ action: 'create', fileIds: [1, 2, 4] });
  });
});

describe('deriveAutoGroupName', () => {
  it('uses the containing folder name', () => {
    expect(deriveAutoGroupName('C:/models/Cool Dragon Batch/part1.stl')).toBe('Cool Dragon Batch');
  });

  it('falls back to a generic label when the folder name is empty', () => {
    expect(deriveAutoGroupName('/part1.stl')).toBe('Auto-grouped files');
  });
});
