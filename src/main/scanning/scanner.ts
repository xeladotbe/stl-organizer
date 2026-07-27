import { basename, extname } from 'path';
import { statSync } from 'fs';
import { upsertFile, markMissingByPath } from '../db/repositories/filesRepo';
import type { FileRow, ModelExt } from '../../shared/types';

function extOf(path: string): ModelExt | null {
  const ext = extname(path).toLowerCase().slice(1);
  return ext === 'stl' || ext === '3mf' || ext === 'obj' ? ext : null;
}

export function isModelFile(path: string): boolean {
  return extOf(path) !== null;
}

/** Stats the file and upserts its DB row. Returns null if it's not a model file, or it vanished before it could be read. */
export function scanFile(folderId: number, path: string): FileRow | null {
  const ext = extOf(path);
  if (!ext) return null;

  let stat;
  try {
    stat = statSync(path);
  } catch {
    return null;
  }

  return upsertFile({
    folderId,
    path,
    filename: basename(path),
    ext,
    size: stat.size,
    mtimeMs: Math.round(stat.mtimeMs)
  });
}

export function removeFile(path: string): boolean {
  if (!isModelFile(path)) return false;
  markMissingByPath(path);
  return true;
}
