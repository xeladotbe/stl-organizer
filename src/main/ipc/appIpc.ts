import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron'
import { openSettingsWindow } from '../settingsWindow'

export function registerAppHandlers(): void {
  ipcMain.on('app:openFoldersWindow', () => openSettingsWindow())

  ipcMain.handle('app:pickHdriFile', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'HDRI', extensions: ['hdr', 'exr'] }]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
