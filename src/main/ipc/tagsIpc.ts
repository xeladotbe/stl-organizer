import { ipcMain } from 'electron';
import {
  listTags,
  createTag,
  renameTag,
  setTagColor,
  deleteTag,
  listFileTagLinks
} from '../db/repositories/tagsRepo';
import type { TagRow, FileTagLink } from '../../shared/types';

export function registerTagHandlers(): void {
  ipcMain.handle('tags:list', (): TagRow[] => listTags());
  ipcMain.handle('tags:create', (_event, name: string, color: string | null = null): TagRow =>
    createTag(name, color)
  );
  ipcMain.handle('tags:rename', (_event, id: number, name: string): void => renameTag(id, name));
  ipcMain.handle('tags:setColor', (_event, id: number, color: string | null): void =>
    setTagColor(id, color)
  );
  ipcMain.handle('tags:delete', (_event, id: number): void => deleteTag(id));
  ipcMain.handle('tags:fileLinks', (): FileTagLink[] => listFileTagLinks());
}
