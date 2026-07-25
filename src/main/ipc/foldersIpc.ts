import { ipcMain, dialog, BrowserWindow } from 'electron'
import { addFolder, removeFolder, listFolders } from '../db/repositories/foldersRepo'
import { startWatching, stopWatching } from '../watcher/watcherManager'
import type { WatchedFolderRow } from '../../shared/types'

export function registerFolderHandlers(): void {
  ipcMain.handle('folders:add', async (event): Promise<WatchedFolderRow | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null

    const folder = addFolder(result.filePaths[0])
    startWatching(folder)
    return folder
  })

  ipcMain.handle('folders:remove', async (_event, id: number): Promise<void> => {
    await stopWatching(id)
    removeFolder(id)
  })

  ipcMain.handle('folders:list', (): WatchedFolderRow[] => listFolders())
}
