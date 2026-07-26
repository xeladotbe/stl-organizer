import { ipcMain, shell } from 'electron'
import { rename } from 'fs/promises'
import { dirname, join } from 'path'
import {
  listFiles,
  getFileById,
  markMissingByPath,
  setCategory,
  setFileTags,
  renameFile
} from '../db/repositories/filesRepo'
import { dissolveGroupIfSparse } from '../db/repositories/modelGroupsRepo'
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
    if (file.group_id != null) dissolveGroupIfSparse(file.group_id)
  })

  // Rename on disk first, then update the DB row's path — by the time chokidar's debounced
  // 'add' fires for the new path (awaitWriteFinish ~1.5s), the row already matches, so
  // upsertFile's existing-row branch applies and hash/thumbnail state survives untouched.
  ipcMain.handle('files:rename', async (_event, id: number, newBaseName: string): Promise<void> => {
    const file = getFileById(id)
    if (!file) return
    const newFilename = `${newBaseName}.${file.ext}`
    const newPath = join(dirname(file.path), newFilename)
    if (newPath === file.path) return
    await rename(file.path, newPath)
    renameFile(id, newPath, newFilename)
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
