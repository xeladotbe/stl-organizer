import { ipcMain } from 'electron'
import { openSettingsWindow } from '../settingsWindow'

export function registerAppHandlers(): void {
  ipcMain.on('app:openFoldersWindow', () => openSettingsWindow())
}
