import { ipcMain } from 'electron'
import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory
} from '../db/repositories/categoriesRepo'
import type { CategoryRow } from '../../shared/types'

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:list', (): CategoryRow[] => listCategories())
  ipcMain.handle(
    'categories:create',
    (_event, name: string, color: string | null = null): CategoryRow => createCategory(name, color)
  )
  ipcMain.handle('categories:rename', (_event, id: number, name: string): void =>
    renameCategory(id, name)
  )
  ipcMain.handle('categories:delete', (_event, id: number): void => deleteCategory(id))
}
