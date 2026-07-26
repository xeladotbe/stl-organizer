import { ipcMain } from 'electron'
import {
  listGroups,
  createGroup,
  renameGroup,
  setGroupCategory,
  addFilesToGroup,
  removeFileFromGroup,
  deleteGroup
} from '../db/repositories/modelGroupsRepo'
import type { ModelGroupRow } from '../../shared/types'

export function registerModelGroupHandlers(): void {
  ipcMain.handle('groups:list', (): ModelGroupRow[] => listGroups())
  ipcMain.handle('groups:create', (_event, name: string, fileIds: number[]): ModelGroupRow =>
    createGroup(name, fileIds)
  )
  ipcMain.handle('groups:rename', (_event, id: number, name: string): void => renameGroup(id, name))
  ipcMain.handle('groups:setCategory', (_event, id: number, categoryId: number | null): void =>
    setGroupCategory(id, categoryId)
  )
  ipcMain.handle('groups:addFiles', (_event, id: number, fileIds: number[]): void =>
    addFilesToGroup(id, fileIds)
  )
  ipcMain.handle('groups:removeFile', (_event, fileId: number): void => removeFileFromGroup(fileId))
  ipcMain.handle('groups:delete', (_event, id: number): void => deleteGroup(id))
}
