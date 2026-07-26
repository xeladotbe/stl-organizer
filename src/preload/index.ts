import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  WatchedFolderRow,
  FileRow,
  ListFilesFilter,
  ScanProgressEvent,
  FileChangedEvent,
  TagRow,
  CategoryRow,
  FileTagLink,
  ModelGroupRow
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// Custom APIs for renderer
const api = {
  folders: {
    add: (): Promise<WatchedFolderRow | null> => ipcRenderer.invoke('folders:add'),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('folders:remove', id),
    list: (): Promise<WatchedFolderRow[]> => ipcRenderer.invoke('folders:list')
  },
  files: {
    list: (filter?: ListFilesFilter): Promise<FileRow[]> =>
      ipcRenderer.invoke('files:list', filter),
    get: (id: number): Promise<FileRow | null> => ipcRenderer.invoke('files:get', id),
    moveToTrash: (id: number): Promise<void> => ipcRenderer.invoke('files:moveToTrash', id),
    setCategory: (id: number, categoryId: number | null): Promise<void> =>
      ipcRenderer.invoke('files:setCategory', id, categoryId),
    setTags: (id: number, tagIds: number[]): Promise<void> =>
      ipcRenderer.invoke('files:setTags', id, tagIds),
    rename: (id: number, newBaseName: string): Promise<void> =>
      ipcRenderer.invoke('files:rename', id, newBaseName),
    setVisible: (fileIds: number[]): void => ipcRenderer.send('files:setVisible', fileIds)
  },
  duplicates: {
    list: (): Promise<FileRow[]> => ipcRenderer.invoke('duplicates:list')
  },
  groups: {
    list: (): Promise<ModelGroupRow[]> => ipcRenderer.invoke('groups:list'),
    create: (name: string, fileIds: number[]): Promise<ModelGroupRow> =>
      ipcRenderer.invoke('groups:create', name, fileIds),
    rename: (id: number, name: string): Promise<void> =>
      ipcRenderer.invoke('groups:rename', id, name),
    setCategory: (id: number, categoryId: number | null): Promise<void> =>
      ipcRenderer.invoke('groups:setCategory', id, categoryId),
    addFiles: (id: number, fileIds: number[]): Promise<void> =>
      ipcRenderer.invoke('groups:addFiles', id, fileIds),
    removeFile: (fileId: number): Promise<void> => ipcRenderer.invoke('groups:removeFile', fileId),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('groups:delete', id)
  },
  tags: {
    list: (): Promise<TagRow[]> => ipcRenderer.invoke('tags:list'),
    create: (name: string, color?: string | null): Promise<TagRow> =>
      ipcRenderer.invoke('tags:create', name, color ?? null),
    rename: (id: number, name: string): Promise<void> =>
      ipcRenderer.invoke('tags:rename', id, name),
    setColor: (id: number, color: string | null): Promise<void> =>
      ipcRenderer.invoke('tags:setColor', id, color),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('tags:delete', id),
    fileLinks: (): Promise<FileTagLink[]> => ipcRenderer.invoke('tags:fileLinks')
  },
  categories: {
    list: (): Promise<CategoryRow[]> => ipcRenderer.invoke('categories:list'),
    create: (name: string, color?: string | null): Promise<CategoryRow> =>
      ipcRenderer.invoke('categories:create', name, color ?? null),
    rename: (id: number, name: string): Promise<void> =>
      ipcRenderer.invoke('categories:rename', id, name),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('categories:delete', id)
  },
  app: {
    openFoldersWindow: (): void => ipcRenderer.send('app:openFoldersWindow')
  },
  onScanProgress: (callback: (event: ScanProgressEvent) => void): (() => void) =>
    subscribe('scan:progress', callback),
  onFilesChanged: (callback: (event: FileChangedEvent) => void): (() => void) =>
    subscribe('files:changed', callback)
}

export type Api = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
