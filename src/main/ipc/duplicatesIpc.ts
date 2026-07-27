import { ipcMain } from 'electron';
import { listDuplicateFiles } from '../db/repositories/filesRepo';
import type { FileRow } from '../../shared/types';

export function registerDuplicateHandlers(): void {
  ipcMain.handle('duplicates:list', (): FileRow[] => listDuplicateFiles());
}
