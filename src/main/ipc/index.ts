import type { BrowserWindow } from 'electron'
import { registerFolderHandlers } from './foldersIpc'
import { registerFileHandlers } from './filesIpc'
import { registerDuplicateHandlers } from './duplicatesIpc'
import { registerTagHandlers } from './tagsIpc'
import { registerCategoryHandlers } from './categoriesIpc'
import { appEvents } from '../appEvents'
import type { ScanProgressEvent, FileChangedEvent } from '../../shared/types'

export function registerIpcHandlers(): void {
  registerFolderHandlers()
  registerFileHandlers()
  registerDuplicateHandlers()
  registerTagHandlers()
  registerCategoryHandlers()
}

/** Forwards main-process watcher/scanner/hashing events to the renderer as push events. */
export function forwardScanEventsTo(win: BrowserWindow): void {
  appEvents.on('progress', (payload: ScanProgressEvent) => {
    if (!win.isDestroyed()) win.webContents.send('scan:progress', payload)
  })
  appEvents.on('file-changed', (payload: FileChangedEvent) => {
    if (!win.isDestroyed()) win.webContents.send('files:changed', payload)
  })
}
