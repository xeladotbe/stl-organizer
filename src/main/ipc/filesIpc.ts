import { ipcMain, shell } from 'electron'
import {
  listFiles,
  getFileById,
  markMissingByPath,
  setCategory,
  setFileTags
} from '../db/repositories/filesRepo'
import { setPriorityFileIds } from '../priorityQueue'
import { scheduleHashSweep } from '../hashing/hashQueue'
import { scheduleThumbnailSweep } from '../thumbnails/thumbnailQueue'
import type { FileRow, ListFilesFilter } from '../../shared/types'

export function registerFileHandlers(): void {
  ipcMain.handle('files:list', (_event, filter?: ListFilesFilter): FileRow[] => listFiles(filter))
  ipcMain.handle('files:get', (_event, id: number): FileRow | null => getFileById(id) ?? null)

  ipcMain.handle('files:moveToTrash', async (_event, id: number): Promise<void> => {
    const file = getFileById(id)
    if (!file) return
    await shell.trashItem(file.path)
    markMissingByPath(file.path)
  })

  ipcMain.handle('files:setCategory', (_event, id: number, categoryId: number | null): void =>
    setCategory(id, categoryId)
  )
  ipcMain.handle('files:setTags', (_event, id: number, tagIds: number[]): void =>
    setFileTags(id, tagIds)
  )

  // Fire-and-forget: the renderer reports which files are currently on screen so hashing/thumbnail
  // sweeps can process those first instead of grinding through the backlog in arbitrary order.
  ipcMain.on('files:setVisible', (_event, fileIds: number[]) => {
    setPriorityFileIds(fileIds)
    scheduleHashSweep()
    scheduleThumbnailSweep()
  })
}
